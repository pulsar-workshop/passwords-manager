import { xchacha20poly1305 } from "@noble/ciphers/chacha.js"
import { crypto } from "pulsar"
import { fromBase64, toBase64, utf8Decode, utf8Encode } from "./encoding.ts"
import type { Entry, SealedEntry, VaultMeta } from "./types.ts"

/** OWASP's 2023 figure for PBKDF2-HMAC-SHA256. */
export const ITERATIONS = 600_000

const CHECK = "passwords-vault-v1"
const CHECK_CONTEXT = "check"
const NONCE_BYTES = 24

export type Primitives = {
  readonly randomBytes: (length: number) => Promise<string>
  readonly pbkdf2: (options: {
    readonly password: string
    readonly salt: string
    readonly iterations: number
  }) => Promise<string | null>
}

let primitives: Primitives = crypto

/** Tests swap in Bun's crypto; the app uses the native host primitives. */
export const usePrimitives = (next: Primitives): void => {
  primitives = next
}

export const randomBytes = async (length: number): Promise<Uint8Array> => {
  return fromBase64(await primitives.randomBytes(length))
}

const deriveKey = async (password: string, meta: Omit<VaultMeta, "check">): Promise<Uint8Array> => {
  const key = await primitives.pbkdf2({ password, salt: meta.salt, iterations: meta.iterations })

  if (!key) throw new Error("key derivation failed")

  return fromBase64(key)
}

// The context (an entry ID) is authenticated, so a server cannot swap one entry's data for another's.
const seal = async (key: Uint8Array, text: string, context: string): Promise<string> => {
  const nonce = await randomBytes(NONCE_BYTES)
  const box = xchacha20poly1305(key, nonce, utf8Encode(context)).encrypt(utf8Encode(text))
  const out = new Uint8Array(NONCE_BYTES + box.length)

  out.set(nonce)
  out.set(box, NONCE_BYTES)

  return toBase64(out)
}

const open = (key: Uint8Array, sealed: string, context: string): string | null => {
  try {
    const bytes = fromBase64(sealed)
    const nonce = bytes.subarray(0, NONCE_BYTES)
    const box = bytes.subarray(NONCE_BYTES)

    return utf8Decode(xchacha20poly1305(key, nonce, utf8Encode(context)).decrypt(box))
  } catch {
    // A wrong key or tampered data fails authentication; callers treat both as unreadable.
    return null
  }
}

export const createVault = async (password: string): Promise<{ meta: VaultMeta; key: Uint8Array }> => {
  const salt = toBase64(await randomBytes(16))
  const key = await deriveKey(password, { salt, iterations: ITERATIONS })
  const check = await seal(key, CHECK, CHECK_CONTEXT)

  return { meta: { salt, iterations: ITERATIONS, check }, key }
}

/** The key for this vault, or null when the password is wrong. */
export const unlockVault = async (password: string, meta: VaultMeta): Promise<Uint8Array | null> => {
  const key = await deriveKey(password, meta)

  return open(key, meta.check, CHECK_CONTEXT) === CHECK ? key : null
}

export const sealEntry = async (key: Uint8Array, entry: Entry): Promise<SealedEntry> => {
  const data = await seal(key, JSON.stringify(entry), entry.ID)

  return { ID: entry.ID, updatedAT: entry.updatedAT, data }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const text = (value: unknown): string => {
  return typeof value === "string" ? value : ""
}

export const openEntry = (key: Uint8Array, sealed: SealedEntry): Entry | null => {
  const json = open(key, sealed.data, sealed.ID)

  if (json === null) return null

  let value: unknown

  try {
    value = JSON.parse(json) as unknown
  } catch {
    return null
  }

  if (!isRecord(value)) return null

  return {
    ID: sealed.ID,
    title: text(value.title),
    username: text(value.username),
    password: text(value.password),
    URL: text(value.URL),
    notes: text(value.notes),
    createdAT: typeof value.createdAT === "number" ? value.createdAT : sealed.updatedAT,
    updatedAT: sealed.updatedAT,
  }
}
