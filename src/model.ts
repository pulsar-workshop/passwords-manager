import type { RemoteState, SealedEntry, VaultMeta } from "./types.ts"

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export const parseVaultMeta = (value: unknown): VaultMeta | null => {
  if (!isRecord(value)) return null

  const { salt, iterations, check } = value

  if (typeof salt !== "string" || typeof check !== "string") return null
  if (typeof iterations !== "number" || !Number.isInteger(iterations) || iterations < 1) return null

  return { salt, iterations, check }
}

export const parseSealed = (value: unknown): SealedEntry[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap((item: unknown) => {
    if (!isRecord(item)) return []

    const { ID, updatedAT, data } = item

    if (typeof ID !== "string" || typeof data !== "string" || typeof updatedAT !== "number") return []

    return [{ ID, updatedAT, data }]
  })
}

export const parseDeleted = (value: unknown): Record<string, number> => {
  if (!isRecord(value)) return {}

  const result: Record<string, number> = {}

  for (const [ID, at] of Object.entries(value)) {
    if (typeof at === "number" && Number.isFinite(at)) result[ID] = at
  }

  return result
}

export const parseRemote = (text: string): RemoteState | null => {
  let value: unknown

  try {
    value = JSON.parse(text) as unknown
  } catch {
    return null
  }

  if (!isRecord(value)) return null

  return {
    vault: parseVaultMeta(value.vault),
    entries: parseSealed(value.entries),
    deleted: parseDeleted(value.deleted),
  }
}

export type Merged = {
  readonly sealed: SealedEntry[]
  readonly deleted: Record<string, number>
  readonly changed: readonly string[]
}

/** Newer wins per entry; a deletion wins over any version that is not newer than it. */
export const mergeSealed = (
  local: readonly SealedEntry[],
  localDeleted: Readonly<Record<string, number>>,
  remote: RemoteState,
): Merged => {
  const deleted: Record<string, number> = { ...localDeleted }

  for (const [ID, at] of Object.entries(remote.deleted)) deleted[ID] = Math.max(deleted[ID] ?? 0, at)

  const byID = new Map(local.map((entry) => [entry.ID, entry]))
  const changed: string[] = []

  for (const entry of remote.entries) {
    const mine = byID.get(entry.ID)

    if (mine && mine.updatedAT >= entry.updatedAT) continue

    byID.set(entry.ID, entry)
    changed.push(entry.ID)
  }

  const sealed = [...byID.values()].filter((entry) => {
    const at = deleted[entry.ID]

    if (at === undefined || entry.updatedAT > at) return true

    changed.push(entry.ID)

    return false
  })

  return { sealed, deleted, changed }
}
