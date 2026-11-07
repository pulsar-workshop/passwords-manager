# Passwords Manager

A small password manager built with [Pulsar](https://github.com/riclud/pulsar), in the
style of [todo-list](https://github.com/pulsar-workshop/todo-list). It runs on the
desktop and on Android and syncs through a tiny self-hosted server.

- A master password unlocks the vault. It cannot be recovered.
- Entries hold a title, username, password, website and notes. Search, copy, a password
  generator and light/dark themes are built in.
- On Android the vault can open with a fingerprint: the key is kept behind a Keystore key
  that only a strong biometric check unlocks.
- The clipboard clears 30 seconds after a password is copied. The vault locks after five
  idle minutes, and on a phone after a minute in the background.

## Security

The key is derived from the master password with PBKDF2-HMAC-SHA256 (600,000 iterations,
random 16-byte salt) by the native host, and each entry is sealed with XChaCha20-Poly1305
(`@noble/ciphers`), bound to its ID. Only ciphertext is stored on disk and sent to the
server; the server sees entry IDs and change times, never the contents or the key.

## Requirements

- [Bun](https://bun.sh)
- Pulsar 2.1.0 or newer (`crypto.pbkdf2` and `biometric`)

## Run

```
bun install
bun run dev
```

## Sync server

```
bun run server                  # PORT=8010, DB=passwords.db, PASSWORD= by default
bun run build:server:linux      # a single binary in dist/
```

`deploy/passwords-manager-sync.service` runs the binary from `/opt/passwords-manager-sync`.
Put `PASSWORD=...` in a `.env` beside it, then enter the address, port and that password in
the app's settings. A new device that points at a server which already holds a vault joins
it with the same master password.

## Test

```
bun test
```
