import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

const dir = mkdtempSync(join(tmpdir(), "passwords-manager-server-"))

let server: ReturnType<typeof Bun.spawn> | null = null
let base = ""

const readPort = async (stream: ReadableStream<Uint8Array>): Promise<string> => {
  const reader = stream.getReader()
  const dec = new TextDecoder()

  let buf = ""

  for (;;) {
    const { value, done } = await reader.read()

    if (done) throw new Error("server exited")

    buf += dec.decode(value)

    const match = buf.match(/:(\d+) \(/)

    if (match) return match[1]!
  }
}

const post = (body: unknown) => {
  return fetch(`${base}/state`, {
    method: "POST",
    headers: { authorization: "Bearer pw", "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const vault = { salt: "c2FsdA==", iterations: 600000, check: "Y2hlY2s=" }

beforeAll(async () => {
  server = Bun.spawn(["bun", join(import.meta.dir, "server.ts")], {
    env: { ...process.env, PORT: "0", PASSWORD: "pw", DB: join(dir, "test.db") },
    stdout: "pipe",
  })

  const port = await readPort(server.stdout as ReadableStream<Uint8Array>)

  base = `http://127.0.0.1:${port}`
})

afterAll(() => {
  server?.kill()
  rmSync(dir, { recursive: true, force: true })
})

describe("sync server", () => {
  test("rejects requests without the password", async () => {
    expect((await fetch(`${base}/state`)).status).toBe(401)
  })

  test("keeps the first vault and the newer entry", async () => {
    await post({ vault, entries: [{ ID: "a", updatedAT: 2, data: "new" }], deleted: {} })

    const response = await post({ vault, entries: [{ ID: "a", updatedAT: 1, data: "old" }], deleted: {} })
    const state = (await response.json()) as { vault: unknown; entries: unknown[] }

    expect(state.vault).toEqual(vault)
    expect(state.entries).toEqual([{ ID: "a", updatedAT: 2, data: "new" }])
  })

  test("refuses entries from another vault", async () => {
    const response = await post({
      vault: { ...vault, salt: "b3RoZXI=" },
      entries: [{ ID: "b", updatedAT: 1, data: "x" }],
    })

    expect(response.status).toBe(409)
  })

  test("a deletion removes an older entry", async () => {
    const response = await post({ vault, entries: [], deleted: { a: 5 } })
    const state = (await response.json()) as { entries: unknown[]; deleted: Record<string, number> }

    expect(state.entries).toEqual([])
    expect(state.deleted).toEqual({ a: 5 })
  })
})
