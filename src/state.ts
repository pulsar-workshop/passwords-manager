import { App, createBreakpoints, createState, type ColorValue } from "pulsar"
import { tr } from "./i18n.ts"
import type { Entry, SealedEntry, SyncSettings, VaultMeta } from "./types.ts"

export const DEFAULT_PORT = "8010"

export const app = new App()

export const breakpoints = createBreakpoints(app)

/** What is saved and synced: everything here is either public metadata or ciphertext. */
export const state = createState({
  sync: { dirty: false },
  syncSettings: { host: "", port: DEFAULT_PORT, password: "" } as SyncSettings,
  vault: null as VaultMeta | null,
  sealed: [] as SealedEntry[],
  deleted: {} as Record<string, number>,
})

/**
 * choose: no vault yet, pick a new one or connect; create and connect follow from it;
 * join: the server holds a vault, enter its master password; unlock: this device's vault.
 */
export type LockMode = "choose" | "create" | "connect" | "join" | "unlock"

export const ui = createState({
  locked: true,
  lockMode: "choose" as LockMode,
  lockPassword: "",
  lockRepeat: "",
  lockError: "",
  unlocking: false,
  entries: [] as Entry[],
  query: "",
  draft: null as Entry | null,
  draftNew: false,
  draftError: "",
  showPassword: false,
  settingsOpen: false,
  scannerAvailable: false,
  connectHost: "",
  connectPort: DEFAULT_PORT,
  connectPassword: "",
  connectError: "",
  connecting: false,
  pairOpen: false,
  biometricAvailable: false,
  biometricEnabled: false,
  themeDark: true,
  syncStatus: "off",
})

export const syncLabel = (): string => {
  const status = ui.syncStatus

  if (status === "ok") return tr("Синхронизировано")
  if (status === "error") return tr("Сервер недоступен")
  if (status === "conflict") return tr("На сервере другое хранилище")
  if (status === "idle") return tr("Ожидание")

  return tr("Синхронизация выключена")
}

export const syncColor = (): ColorValue => {
  const status = ui.syncStatus

  if (status === "ok") return "#22c55e"
  if (status === "error" || status === "conflict") return "#ef4444"

  return "subtext"
}
