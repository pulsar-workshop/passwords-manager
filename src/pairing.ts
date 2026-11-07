import { xchacha20poly1305 } from "@noble/ciphers/chacha.js"
import { x25519 } from "@noble/curves/ed25519.js"
import { sha256 } from "@noble/hashes/sha2.js"
import { dialog, net } from "pulsar"
import { fromBase64, toBase64 } from "./encoding.ts"
import { tr } from "./i18n.ts"
import { currentKey, unlockWithKey } from "./session.ts"
import { state, ui } from "./state.ts"
import { randomBytes } from "./vault.ts"

// Linking a device: the computer shows a one-time X25519 key in the QR code, the phone
// answers with its own through the server, both show a code from the shared secret, and
// after the user allows it the computer sends the vault key sealed with that secret.

const POLL_MS = 1500
const PAIR_TTL_MS = 120_000

const base = () => `http://${state.syncSettings.host}:${state.syncSettings.port}`

const headers = (): Record<string, string> => {
  const out: Record<string, string> = { "content-type": "application/json" }

  if (state.syncSettings.password) out.authorization = `Bearer ${state.syncSettings.password}`

  return out
}

const read = async (id: string): Promise<{ pub?: string; box?: string }> => {
  const response = await net.fetch(`${base()}/pair?id=${id}`, { headers: headers(), timeoutMs: 5000 })

  return response.status === 200 ? (JSON.parse(response.text) as { pub?: string; box?: string }) : {}
}

const write = async (body: Record<string, string>): Promise<void> => {
  await net.fetch(`${base()}/pair`, { method: "POST", headers: headers(), body: JSON.stringify(body), timeoutMs: 5000 })
}

const sharedKey = (secret: Uint8Array, other: Uint8Array) => sha256(x25519.getSharedSecret(secret, other))

/** Four digits both screens show, so the user can see they talk to each other. */
export const pairCode = (shared: Uint8Array): string => {
  return String(((shared[0]! << 8) | shared[1]!) % 10000).padStart(4, "0")
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms))

/** Computer side: a one-time offer for the QR code, and a loop that answers the phone. */
export const offerPairing = async (isOpen: () => boolean): Promise<string> => {
  const id = Array.from(await randomBytes(8), (byte) => byte.toString(16).padStart(2, "0")).join("")
  const secret = await randomBytes(32)
  const offer = `${id}.${encodeURIComponent(toBase64(x25519.getPublicKey(secret)))}`

  void (async () => {
    const deadline = Date.now() + PAIR_TTL_MS

    while (isOpen() && Date.now() < deadline) {
      await wait(POLL_MS)

      const answer = await read(id).catch(() => ({ pub: undefined }))

      if (!answer.pub) continue

      const shared = sharedKey(secret, fromBase64(answer.pub))
      const allow = await dialog.message({ title: tr("Подключить устройство?"), text: tr("Код на телефоне: {code}", { code: pairCode(shared) }) })
      const key = currentKey()

      if (!allow || !key) return

      const nonce = await randomBytes(24)
      const box = xchacha20poly1305(shared, nonce).encrypt(key)
      const sealed = new Uint8Array(24 + box.length)

      sealed.set(nonce)
      sealed.set(box, 24)
      await write({ id, box: toBase64(sealed) })
      await dialog.toast(tr("Устройство подключено"))

      ui.pairOpen = false

      return
    }
  })()

  return offer
}

/** Phone side: answers the offer from the QR code and opens the vault once the computer allows it. */
export const acceptPairing = async (offer: string): Promise<boolean> => {
  const [id, pub] = offer.split(".")

  if (!id || !pub) return false

  const secret = await randomBytes(32)
  const shared = sharedKey(secret, fromBase64(decodeURIComponent(pub)))

  await write({ id, pub: toBase64(x25519.getPublicKey(secret)) })

  ui.lockError = tr("Подтвердите на компьютере. Код: {code}", { code: pairCode(shared) })

  const deadline = Date.now() + PAIR_TTL_MS

  while (Date.now() < deadline && ui.locked) {
    await wait(POLL_MS)

    const answer = await read(id).catch(() => ({ box: undefined }))

    if (!answer.box) continue

    try {
      const bytes = fromBase64(answer.box)
      const key = xchacha20poly1305(shared, bytes.subarray(0, 24)).decrypt(bytes.subarray(24))

      return unlockWithKey(key)
    } catch {
      return false
    }
  }

  return false
}
