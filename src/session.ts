import { clipboard, dialog } from "pulsar"
import { tr } from "./i18n.ts"
import { state, ui } from "./state.ts"
import { persistState } from "./storage.ts"
import type { Entry } from "./types.ts"
import { createVault, openEntry, randomBytes, sealEntry, unlockVault } from "./vault.ts"

const IDLE_LOCK_MS = 5 * 60_000
const CLIPBOARD_CLEAR_MS = 30_000
const MIN_MASTER_LENGTH = 8

// The key lives only in this module: never in reactive state, never on disk.
let key: Uint8Array | null = null
let lastActivity = Date.now()

type Hooks = {
  readonly changed: () => void
  readonly unlocked: () => void
  readonly checkServer: () => Promise<boolean>
}

let hooks: Hooks = {
  changed: () => {},
  unlocked: () => {},
  checkServer: () => Promise.resolve(false),
}

/** Sync registers itself here, which keeps this module free of a cycle with it. */
export const setSessionHooks = (next: Hooks): void => {
  hooks = next
}

export const touch = (): void => {
  lastActivity = Date.now()
}

const byTitle = (a: Entry, b: Entry) => {
  return a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
}

export const reopenEntries = (): void => {
  const current = key

  if (!current) return

  ui.entries = state.sealed
    .map((sealed) => openEntry(current, sealed))
    .filter((entry): entry is Entry => entry !== null)
    .sort(byTitle)
}

const finishUnlock = (next: Uint8Array): void => {
  key = next
  touch()

  ui.locked = false
  ui.lockPassword = ""
  ui.lockRepeat = ""
  ui.lockError = ""

  reopenEntries()
  hooks.unlocked()
}

const createNew = async (password: string): Promise<void> => {
  if (password.length < MIN_MASTER_LENGTH) {
    ui.lockError = tr("Мастер-пароль — не короче 8 символов")

    return
  }

  if (password !== ui.lockRepeat) {
    ui.lockError = tr("Пароли не совпадают")

    return
  }

  // Another device may have made a vault on this server since the screen opened.
  if (await hooks.checkServer()) return

  const vault = await createVault(password)

  state.vault = vault.meta
  persistState()
  hooks.changed()
  finishUnlock(vault.key)
}

const unlockExisting = async (password: string): Promise<void> => {
  const vault = state.vault

  if (!vault) return

  const next = await unlockVault(password, vault)

  if (!next) {
    ui.lockError = tr("Неверный мастер-пароль")

    return
  }

  if (ui.lockMode === "join") persistState()

  finishUnlock(next)
}

export const submitLock = async (): Promise<void> => {
  const password = ui.lockPassword

  if (ui.unlocking || !password) return

  ui.unlocking = true
  ui.lockError = ""

  try {
    if (ui.lockMode === "create") await createNew(password)
    else await unlockExisting(password)
  } finally {
    ui.unlocking = false
  }
}

export const lock = (): void => {
  key = null

  ui.locked = true
  ui.lockMode = state.vault ? "unlock" : "create"
  ui.entries = []
  ui.draft = null
  ui.settingsOpen = false
  ui.showPassword = false
}

export const lockWhenIdle = (): void => {
  if (key && Date.now() - lastActivity > IDLE_LOCK_MS) lock()
}

const store = async (entry: Entry): Promise<void> => {
  const current = key

  if (!current) return

  const sealed = await sealEntry(current, entry)

  state.sealed = [...state.sealed.filter((item) => item.ID !== entry.ID), sealed]
  persistState()
  reopenEntries()
  hooks.changed()
}

const newID = async () => {
  const bytes = await randomBytes(12)

  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export const openDraft = (entry: Entry | null): void => {
  touch()

  ui.draftError = ""
  ui.showPassword = false
  ui.draftNew = entry === null
  ui.draft = entry
    ? { ...entry }
    : { ID: "", title: "", username: "", password: "", URL: "", notes: "", createdAT: 0, updatedAT: 0 }
}

export const closeDraft = (): void => {
  ui.draft = null
}

export const updateDraft = (patch: Partial<Omit<Entry, "ID" | "createdAT">>): void => {
  const draft = ui.draft

  if (!draft) return

  touch()

  ui.draft = { ...draft, ...patch }
}

export const saveDraft = async (): Promise<void> => {
  const draft = ui.draft

  if (!draft) return

  if (!draft.title.trim()) {
    ui.draftError = tr("Название не может быть пустым")

    return
  }

  const now = Date.now()
  const ID = draft.ID || (await newID())

  await store({ ...draft, ID, title: draft.title.trim(), createdAT: draft.createdAT || now, updatedAT: now })
  closeDraft()
}

export const deleteDraft = async (): Promise<void> => {
  const draft = ui.draft

  if (!draft) return

  const ok = await dialog.message({ title: tr("Удалить запись?"), text: tr("Запись нельзя будет восстановить.") })

  if (!ok) return

  closeDraft()

  if (!draft.ID) return

  state.deleted = { ...state.deleted, [draft.ID]: Date.now() }
  state.sealed = state.sealed.filter((item) => item.ID !== draft.ID)
  persistState()
  reopenEntries()
  hooks.changed()
}

let clearTimer: ReturnType<typeof setTimeout> | null = null

export const copySecret = async (text: string, notice: string, clears: boolean): Promise<void> => {
  if (!text) return

  touch()
  await clipboard.write(text)
  await dialog.toast(notice)

  if (!clears) return

  if (clearTimer !== null) clearTimeout(clearTimer)

  clearTimer = setTimeout(() => {
    clearTimer = null

    // Leave the clipboard alone if the user has copied something else since.
    void clipboard
      .read()
      .then((current) => (current === text ? clipboard.write("") : true))
      .catch(() => {
        // Clearing is best effort; a failed read leaves the clipboard as it is.
      })
  }, CLIPBOARD_CLEAR_MS)
}

const LOWER = "abcdefghijkmnopqrstuvwxyz"
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const DIGITS = "23456789"
const SYMBOLS = "!#$%&*+-=?@^_"
const ALPHABET = LOWER + UPPER + DIGITS + SYMBOLS
const CLASSES = [LOWER, UPPER, DIGITS, SYMBOLS] as const

/** A password with every character class, drawn without modulo bias. */
export const generatePassword = async (length = 20): Promise<string> => {
  const limit = 256 - (256 % ALPHABET.length)

  for (;;) {
    const bytes = await randomBytes(length * 2)
    const chars = [...bytes].filter((byte) => byte < limit).map((byte) => ALPHABET[byte % ALPHABET.length]!)

    if (chars.length < length) continue

    const password = chars.slice(0, length).join("")

    if (CLASSES.every((set) => [...password].some((char) => set.includes(char)))) return password
  }
}
