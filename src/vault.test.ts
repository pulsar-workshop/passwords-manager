import { beforeAll, describe, expect, test } from "bun:test"
import { pbkdf2Sync, randomBytes } from "crypto"
import { createVault, openEntry, sealEntry, unlockVault, usePrimitives } from "./vault.ts"
import type { Entry } from "./types.ts"

beforeAll(() => {
  usePrimitives({
    randomBytes: (length) => Promise.resolve(randomBytes(length).toString("base64")),
    // A low count keeps the test fast; the app passes the real one to the host.
    pbkdf2: ({ password, salt }) => {
      return Promise.resolve(pbkdf2Sync(password, Buffer.from(salt, "base64"), 1000, 32, "sha256").toString("base64"))
    },
  })
})

const entry: Entry = {
  ID: "e1",
  title: "Почта",
  username: "me@example.com",
  password: "s3cret ключ",
  URL: "https://mail.example.com",
  notes: "",
  createdAT: 1,
  updatedAT: 2,
}

describe("vault", () => {
  test("the right password unlocks, a wrong one does not", async () => {
    const { meta } = await createVault("correct horse")

    expect(await unlockVault("correct horse", meta)).not.toBeNull()
    expect(await unlockVault("wrong", meta)).toBeNull()
  })

  test("an entry survives a round trip and hides its fields", async () => {
    const { key } = await createVault("pw")
    const sealed = await sealEntry(key, entry)

    expect(sealed.data).not.toContain("example")
    expect(openEntry(key, sealed)).toEqual(entry)
  })

  test("data moved to another entry ID is rejected", async () => {
    const { key } = await createVault("pw")
    const sealed = await sealEntry(key, entry)

    expect(openEntry(key, { ...sealed, ID: "e2" })).toBeNull()
  })
})
