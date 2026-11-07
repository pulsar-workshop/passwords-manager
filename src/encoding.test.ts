import { describe, expect, test } from "bun:test"
import { fromBase64, toBase64, utf8Decode, utf8Encode } from "./encoding.ts"

describe("encoding", () => {
  test("utf8 matches TextEncoder for every width", () => {
    const text = "pass ключ € 𝄞 日本"

    expect([...utf8Encode(text)]).toEqual([...new TextEncoder().encode(text)])
    expect(utf8Decode(utf8Encode(text))).toBe(text)
  })

  test("base64 matches Buffer for every padding", () => {
    for (const size of [0, 1, 2, 3, 4, 5, 31, 32]) {
      const bytes = Uint8Array.from({ length: size }, (_, index) => (index * 37 + 11) & 0xff)
      const encoded = toBase64(bytes)

      expect(encoded).toBe(Buffer.from(bytes).toString("base64"))
      expect([...fromBase64(encoded)]).toEqual([...bytes])
    }
  })
})
