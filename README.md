# lkjstr

## Purpose

lkjstr is a local-first Nostr client that lives in tiles. Timelines, threads,
profiles, notifications, search, compose, relays and accounts are tabs you can
split, stack, resize and move, with the keyboard or the pointer. It is written
in Rust and runs in the browser as WebAssembly; there is no lkjstr server.

## What it does

- Reads Home (people you follow), Global, Notifications, Profiles, Threads and
  Search, rendering from the local cache first and then from relays.
- Plans relay requests for you: each author's own relays (NIP-65 outbox),
  shared requests across tiles, scored and backed-off relays.
- Signs with a key kept in this browser, or a NIP-07 signer extension; posts,
  replies, likes, reposts and follows show at once and report each relay's answer.
- Keeps your layout, accounts, drafts, relay scores and recent events on this
  device (IndexedDB).

Current state, limits and next steps: [docs/status.md](docs/status.md).

## Run

Requirements: the Rust toolchain in `rust-toolchain.toml` (with the
`wasm32-unknown-unknown` target), Trunk 0.21.14, Node 24 and pnpm 11 for the
command aliases.

```sh
pnpm dev          # trunk serve on http://127.0.0.1:8417
pnpm build        # release build into dist/, then check-dist
```

## Verify

```sh
pnpm check:repo
pnpm test:quiet
pnpm rust-wasm:quiet
pnpm verify:quiet
docker compose --progress quiet -f docker-compose.yml build verify
docker compose --progress quiet -f docker-compose.yml run --rm verify
```

Details: [docs/verification.md](docs/verification.md).

## Repository map

- `index.html`: Trunk entry; `Cargo.toml`: the browser app package and workspace.
- `crates/`: [protocol, core, web, host, xtask](crates/README.md).
- `static/`: stylesheets and icons.
- `docs/`: [documentation index](docs/README.md).
- `scripts/browser-smoke.mjs`: browser smoke with a fake relay (`pnpm smoke:browser`).

## License

See [LICENSE](LICENSE).
