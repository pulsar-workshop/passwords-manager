import { net } from "pulsar"
import { mergeSealed, parseRemote } from "./model.ts"
import { disableBiometric, lock, reopenEntries } from "./session.ts"
import { tr } from "./i18n.ts"
import { DEFAULT_PORT, state, ui } from "./state.ts"
import { persistState, writeSyncSettings } from "./storage.ts"
import { setStatus } from "./sync-status.ts"
import type { RemoteState, SyncSettings } from "./types.ts"

const TIMEOUT_MS = 5000

let revision = 0
let pushing: Promise<void> | null = null
let pushQueued = false
let pulling = false

export const markDirty = (): void => {
  state.sync.dirty = true
  revision++
}

const syncBase = (): string => {
  if (!state.syncSettings.host) return ""

  return `http://${state.syncSettings.host}:${state.syncSettings.port}`
}

const syncHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { "content-type": "application/json" }

  if (state.syncSettings.password) headers.authorization = `Bearer ${state.syncSettings.password}`

  return headers
}

/** Fetches what the server holds without merging it, for the first screen. */
export const fetchRemote = async (): Promise<RemoteState | null> => {
  const base = syncBase()

  if (!base) return null

  try {
    const response = await net.fetch(`${base}/state`, { headers: syncHeaders(), timeoutMs: TIMEOUT_MS })

    if (response.status < 200 || response.status >= 300) throw new Error(`sync failed: ${response.status}`)

    setStatus("ok")

    return parseRemote(response.text)
  } catch {
    setStatus("error")

    return null
  }
}

export type ServerVault = "off" | "unreachable" | "empty" | "vault"

/** On the first screens: adopt a vault the server already holds, so this device joins it. */
export const probeServer = async (): Promise<ServerVault> => {
  if (state.vault) return "off"
  if (!state.syncSettings.host) return "off"

  const remote = await fetchRemote()

  if (!remote) return "unreachable"
  if (!remote.vault) return "empty"

  state.vault = remote.vault

  ui.lockMode = "join"
  ui.lockError = ""
  ui.lockRepeat = ""
  ui.lockPassword = ""

  return "vault"
}

/** Reads a pairing link from another device's QR code: pmsync://host:port?k=password. */
export const parsePairing = (text: string): SyncSettings | null => {
  const match = text.trim().match(/^pmsync:\/\/([^:/?#\s]+):(\d{1,5})\/?(?:\?k=([^#\s]*))?$/)

  if (!match) return null

  return { host: match[1]!, port: match[2]!, password: decodeURIComponent(match[3] ?? "") }
}

/** The link other devices scan; a computer on localhost names its LAN address instead. */
export const pairingLink = async (): Promise<string | null> => {
  const settings = state.syncSettings

  if (!settings.host) return null

  let host = settings.host

  if (/^(127\.|localhost$|::1$)/.test(host)) {
    const addresses = await fetchAddresses()

    if (addresses.length === 0) return null

    host = addresses[0]!
  }

  return `pmsync://${host}:${settings.port}?k=${encodeURIComponent(settings.password)}`
}

const fetchAddresses = async (): Promise<string[]> => {
  const base = syncBase()

  if (!base) return []

  try {
    const response = await net.fetch(`${base}/info`, { headers: syncHeaders(), timeoutMs: TIMEOUT_MS })
    const info = JSON.parse(response.text) as { addresses?: unknown }

    return Array.isArray(info.addresses)
      ? info.addresses.filter((item): item is string => typeof item === "string")
      : []
  } catch {
    return []
  }
}

/** Saves the server and joins the vault on it; returns an error message or null. */
export const connectToServer = async (settings: SyncSettings): Promise<string | null> => {
  await writeSyncSettings({ ...settings, port: settings.port.trim() || DEFAULT_PORT })

  const result = await probeServer()

  if (result === "vault") return null
  if (result === "empty") return tr("На сервере ещё нет хранилища. Создайте его здесь или на другом устройстве.")

  return tr("Сервер недоступен. Проверьте адрес, порт и пароль.")
}

const isEmptyVault = (): boolean => {
  return state.sealed.length === 0 && Object.keys(state.deleted).length === 0
}

/**
 * The server holds another vault. An empty local one has nothing to lose, so this
 * device switches to the server's vault and asks for its master password; a vault
 * with entries stays and reports the conflict.
 */
const resolveConflict = (remote: RemoteState): void => {
  if (!remote.vault || !isEmptyVault()) {
    setStatus("conflict")

    return
  }

  state.vault = remote.vault
  state.sync.dirty = false
  persistState()
  void disableBiometric()
  lock()

  ui.lockMode = "join"
  ui.lockPassword = ""
  ui.lockError = ""
  setStatus("ok")
}

const applyRemote = (remote: RemoteState): void => {
  if (remote.vault && state.vault && remote.vault.salt !== state.vault.salt) {
    resolveConflict(remote)

    return
  }

  const merged = mergeSealed(state.sealed, state.deleted, remote)

  state.deleted = merged.deleted

  if (merged.changed.length === 0) return

  state.sealed = merged.sealed
  reopenEntries()
  persistState()
}

const pushOnce = async (base: string): Promise<boolean> => {
  const started = revision

  state.sync.dirty = true

  try {
    const response = await net.fetch(`${base}/state`, {
      method: "POST",
      headers: syncHeaders(),
      body: JSON.stringify({ vault: state.vault, entries: state.sealed, deleted: state.deleted }),
      timeoutMs: TIMEOUT_MS,
    })

    if (response.status === 409) {
      const remote = parseRemote(response.text)

      if (remote) resolveConflict(remote)
      else setStatus("conflict")

      return false
    }

    if (response.status < 200 || response.status >= 300) throw new Error(`sync failed: ${response.status}`)

    const remote = parseRemote(response.text)

    if (remote) applyRemote(remote)

    state.sync.dirty = revision !== started
    persistState()

    if (ui.syncStatus !== "conflict") setStatus("ok")

    return true
  } catch {
    setStatus("error")

    return false
  }
}

const runPushes = async (): Promise<void> => {
  let succeeded = true

  do {
    pushQueued = false

    const base = syncBase()

    if (!base || !state.vault) return

    succeeded = await pushOnce(base)
  } while (pushQueued && succeeded)
}

export const push = (): Promise<void> => {
  if (pushing) {
    pushQueued = true

    return pushing
  }

  pushing = runPushes().finally(() => {
    pushing = null
  })

  return pushing
}

export const pull = async (): Promise<void> => {
  if (!syncBase() || !state.vault || state.sync.dirty || pushing || pulling) return

  pulling = true

  try {
    const remote = await fetchRemote()

    if (remote) applyRemote(remote)
  } finally {
    pulling = false
  }
}

export const syncNow = async (): Promise<void> => {
  if (!state.syncSettings.host) return

  if (state.sync.dirty) {
    await push()

    return
  }

  await pull()
}

export const saveSyncConnection = async (params: SyncSettings): Promise<void> => {
  const settings: SyncSettings = {
    host: params.host.trim(),
    port: params.port.trim() || DEFAULT_PORT,
    password: params.password,
  }

  await writeSyncSettings(settings)

  setStatus(settings.host ? "idle" : "off")

  if (!settings.host) return

  if (!state.vault) {
    await probeServer()

    return
  }

  // A different server may hold everything this device has, so send it all.
  markDirty()
  await push()
}
