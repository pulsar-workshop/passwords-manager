const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

const LOOKUP = new Map([...ALPHABET].map((char, index) => [char, index]))

// QuickJS has no TextEncoder, atob or btoa, so the vault does its own conversions.

export const utf8Encode = (text: string): Uint8Array => {
  const bytes: number[] = []

  for (const char of text) {
    const code = char.codePointAt(0) ?? 0

    if (code < 0x80) bytes.push(code)
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63))
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63))
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63))
  }

  return Uint8Array.from(bytes)
}

export const utf8Decode = (bytes: Uint8Array): string => {
  let text = ""
  let index = 0

  while (index < bytes.length) {
    const first = bytes[index]!
    const length = first < 0x80 ? 1 : first < 0xe0 ? 2 : first < 0xf0 ? 3 : 4
    const head = length === 1 ? first : first & (0xff >> (length + 1))

    let code = head

    for (let offset = 1; offset < length; offset++) code = (code << 6) | ((bytes[index + offset] ?? 0) & 63)

    text += String.fromCodePoint(code)
    index += length
  }

  return text
}

export const toBase64 = (bytes: Uint8Array): string => {
  let out = ""

  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index]!
    const b = bytes[index + 1]
    const c = bytes[index + 2]
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)

    out += ALPHABET[(triple >> 18) & 63]! + ALPHABET[(triple >> 12) & 63]!
    out += b === undefined ? "=" : ALPHABET[(triple >> 6) & 63]!
    out += c === undefined ? "=" : ALPHABET[triple & 63]!
  }

  return out
}

export const fromBase64 = (text: string): Uint8Array => {
  const clean = text.replace(/=+$/, "")
  const bytes: number[] = []

  let buffer = 0
  let bits = 0

  for (const char of clean) {
    const value = LOOKUP.get(char)

    if (value === undefined) throw new Error("invalid base64")

    buffer = (buffer << 6) | value
    bits += 6

    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }

  return Uint8Array.from(bytes)
}
