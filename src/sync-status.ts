import { ui } from "./state.ts"

export type SyncStatus = "off" | "idle" | "ok" | "error" | "conflict"

export const setStatus = (status: SyncStatus): void => {
  ui.syncStatus = status
}
