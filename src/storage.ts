import { secureStorage, storage } from "pulsar"
import { parseDeleted, parseSealed, parseVaultMeta } from "./model.ts"
import { DEFAULT_PORT, state, ui } from "./state.ts"
import type { SyncSettings } from "./types.ts"

const PERSIST_DELAY_MS = 200
const SECRET_KEY = "syncPassword"

let persistTimer: ReturnType<typeof setTimeout> | null = null

export const flushState = async (): Promise<void> => {
  if (persistTimer !== null) clearTimeout(persistTimer)

  persistTimer = null

  await storage.setMany({
    vault: state.vault,
    sealed: state.sealed,
    deleted: state.deleted,
    syncDirty: state.sync.dirty,
  })
}

export const persistState = (): void => {
  if (persistTimer !== null) return

  persistTimer = setTimeout(() => void flushState(), PERSIST_DELAY_MS)
}

export const restore = async (): Promise<void> => {
  const [vault, sealed, deleted, dirty] = await Promise.all([
    storage.get("vault"),
    storage.get("sealed"),
    storage.get("deleted"),
    storage.get("syncDirty"),
  ])

  state.vault = parseVaultMeta(vault)
  state.deleted = parseDeleted(deleted)
  state.sealed = parseSealed(sealed)
  state.sync.dirty = dirty === true

  ui.lockMode = state.vault ? "unlock" : "create"
}

const secureAvailable = async (): Promise<boolean> => {
  try {
    return (await secureStorage.available()) === true
  } catch {
    return false
  }
}

const savePassword = async (password: string): Promise<boolean> => {
  if (!(await secureAvailable())) return false

  if (!password) {
    await secureStorage.remove(SECRET_KEY)

    return true
  }

  return (await secureStorage.set(SECRET_KEY, password)) === true
}

const saveConnection = async (settings: SyncSettings): Promise<void> => {
  const secured = await savePassword(settings.password)

  await storage.set("sync", secured ? { host: settings.host, port: settings.port } : settings)
}

export const loadSyncSettings = async (): Promise<void> => {
  const saved = await storage.get("sync")

  if (typeof saved !== "object" || saved === null) return

  const record = saved as Record<string, unknown>
  const host = typeof record.host === "string" ? record.host : ""
  const port = typeof record.port === "string" ? record.port : DEFAULT_PORT
  const stored = typeof record.password === "string" ? record.password : ""
  const secret = (await secureAvailable()) ? await secureStorage.get(SECRET_KEY) : null

  state.syncSettings = { host, port, password: secret ?? stored }

  if (stored) await saveConnection(state.syncSettings)
}

export const writeSyncSettings = async (settings: SyncSettings): Promise<void> => {
  state.syncSettings = settings

  await saveConnection(settings)
}
