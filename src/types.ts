export type Entry = {
  readonly ID: string
  title: string
  username: string
  password: string
  URL: string
  notes: string
  readonly createdAT: number
  updatedAT: number
}

/** An entry as it is stored and synced: only the ID and the time stay readable. */
export type SealedEntry = {
  readonly ID: string
  readonly updatedAT: number
  readonly data: string
}

/** What another device needs to derive the same key from the master password. */
export type VaultMeta = {
  readonly salt: string
  readonly iterations: number
  readonly check: string
}

export type SyncSettings = {
  host: string
  port: string
  password: string
}

export type RemoteState = {
  readonly vault: VaultMeta | null
  readonly entries: readonly SealedEntry[]
  readonly deleted: Readonly<Record<string, number>>
}
