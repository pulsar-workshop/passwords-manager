import { Database } from "bun:sqlite"
import { existsSync, readFileSync } from "fs"
import { dirname, isAbsolute, join } from "path"
import { mergeSealed, parseDeleted, parseSealed, parseVaultMeta } from "./src/model.ts"
import type { RemoteState, SealedEntry, VaultMeta } from "./src/types.ts"

// The server never sees a key: it stores the vault's salt and check, and opaque entries.

const MAX_BODY_BYTES = 32 * 1024 * 1024

const projectDir = import.meta.dir
const standalone = !existsSync(join(projectDir, "server.ts"))
const baseDir = standalone ? dirname(process.execPath) : projectDir

const loadEnv = (path: string): void => {
  if (!existsSync(path)) return

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)

    if (!match) continue

    const key = match[1]!
    const raw = match[2]!

    if (process.env[key] !== undefined) continue

    const quoted = (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))

    process.env[key] = quoted ? raw.slice(1, -1) : raw
  }
}

loadEnv(join(baseDir, ".env"))
loadEnv(join(process.cwd(), ".env"))

const port = Number(process.env.PORT ?? 8010)
const password = process.env.PASSWORD ?? ""
const dbName = process.env.DB ?? "passwords.db"
const dbPath = isAbsolute(dbName) ? dbName : join(baseDir, dbName)

const db = new Database(dbPath)

db.run("PRAGMA journal_mode = WAL")
db.run("PRAGMA busy_timeout = 5000")
db.run("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
db.run("CREATE TABLE IF NOT EXISTS entries (ID TEXT PRIMARY KEY, updatedAT INTEGER NOT NULL, data TEXT NOT NULL)")
db.run("CREATE TABLE IF NOT EXISTS deleted (ID TEXT PRIMARY KEY, at INTEGER NOT NULL)")

const readVault = (): VaultMeta | null => {
  const row = db.query<{ value: string }, []>("SELECT value FROM meta WHERE key = 'vault'").get()

  return row ? parseVaultMeta(JSON.parse(row.value) as unknown) : null
}

const readState = (): RemoteState => {
  const entries = db.query<SealedEntry, []>("SELECT ID, updatedAT, data FROM entries ORDER BY ID").all()
  const deletedRows = db.query<{ ID: string; at: number }, []>("SELECT ID, at FROM deleted").all()

  return {
    vault: readVault(),
    entries,
    deleted: Object.fromEntries(deletedRows.map((row) => [row.ID, row.at])),
  }
}

const writeState = db.transaction((vault: VaultMeta | null, incoming: RemoteState) => {
  const current = readState()

  if (!current.vault && vault) db.run("INSERT INTO meta (key, value) VALUES ('vault', ?)", [JSON.stringify(vault)])

  const merged = mergeSealed(current.entries, current.deleted, incoming)
  const kept = new Set(merged.sealed.map((entry) => entry.ID))

  for (const [ID, at] of Object.entries(merged.deleted)) {
    db.run("INSERT INTO deleted (ID, at) VALUES (?, ?) ON CONFLICT(ID) DO UPDATE SET at = excluded.at", [ID, at])
  }

  for (const entry of current.entries) {
    if (!kept.has(entry.ID)) db.run("DELETE FROM entries WHERE ID = ?", [entry.ID])
  }

  for (const entry of merged.sealed) {
    db.run(
      "INSERT INTO entries (ID, updatedAT, data) VALUES (?, ?, ?) " +
        "ON CONFLICT(ID) DO UPDATE SET updatedAT = excluded.updatedAT, data = excluded.data " +
        "WHERE excluded.updatedAT > entries.updatedAT",
      [entry.ID, entry.updatedAT, entry.data],
    )
  }
})

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const authorized = (request: Request): boolean => {
  return !password || request.headers.get("authorization") === `Bearer ${password}`
}

const handleState = async (request: Request): Promise<Response> => {
  if (request.method === "GET") return Response.json(readState())
  if (request.method !== "POST") return new Response("method not allowed", { status: 405 })

  const body = (await request.json().catch(() => null)) as unknown

  if (!isRecord(body)) return new Response("expected a JSON object", { status: 400 })

  const vault = parseVaultMeta(body.vault)
  const stored = readVault()

  // Entries sealed with another vault's key would be unreadable to every other device.
  if (stored && (!vault || vault.salt !== stored.salt)) return Response.json(readState(), { status: 409 })

  writeState(vault, { vault, entries: parseSealed(body.entries), deleted: parseDeleted(body.deleted) })

  return Response.json(readState())
}

const server = Bun.serve({
  port,
  hostname: "0.0.0.0",
  maxRequestBodySize: MAX_BODY_BYTES,
  fetch(request) {
    const path = new URL(request.url).pathname

    if (path !== "/state") return new Response("not found", { status: 404 })

    if (!authorized(request)) {
      return new Response("unauthorized", { status: 401, headers: { "www-authenticate": "Bearer" } })
    }

    return handleState(request)
  },
})

console.log(`passwords-manager sync on http://0.0.0.0:${server.port} (${dbPath})`)
