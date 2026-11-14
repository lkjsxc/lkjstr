# lkjstr

## Purpose

lkjstr is a local-first Nostr client that lives in tiles. Timelines, threads,
profiles, notifications, search, the composer, media, relays and settings are
tabs you can split, stack, resize and move, with the keyboard or the pointer.
It runs entirely in the browser; there is no lkjstr server.

## Parts

- `web/`: the interface. TypeScript with no framework, built like ytenrich.
  It draws; it never parses an event or opens a socket.
- `crates/`: the engine, Rust compiled to WebAssembly and run in a Worker:
  relays, request planning, the event store, signatures, publishing. See
  [crates/README.md](crates/README.md).
- `web/src/engine/protocol.ts`: the messages between the two.

The interface currently ships with a mock engine so its feel can be finished
first. `crates/lkjstr-web`, the earlier Leptos interface built by Trunk from
the root `index.html`, stays in the tree while the engine is cut out of it.

## Frontend: run, build, verify

Requirements: Node 24 and pnpm 11.

```sh
cd web
pnpm install
pnpm dev      # rebuilds ../dist on change
pnpm serve    # http://127.0.0.1:8417, with the production headers
pnpm check    # repo rules, tsc, biome, vitest: prints "ok check"
pnpm build    # the static site in ../dist: prints "ok build"
pnpm smoke    # drives Chromium against the build: prints "ok smoke"
pnpm shots    # screenshots of every view to ../tmp/screens
```

`dist/` is a complete static site. What the host has to do with it (routing,
content types, headers, caching) is in
[docs/hosting-needs.md](docs/hosting-needs.md).

Details: [docs/frontend.md](docs/frontend.md) and
[docs/design.md](docs/design.md).

## Engine and the earlier interface

Requirements: the Rust toolchain in `rust-toolchain.toml` (with the
`wasm32-unknown-unknown` target) and Trunk 0.21.14. From the repository root:

```sh
pnpm check:repo
pnpm test:quiet
pnpm rust-wasm:quiet
pnpm verify:quiet
```

`pnpm dev` and `pnpm build` at the root still build the Leptos interface
with Trunk into the same `dist/`; do not run them over a frontend build you
mean to publish. State and gates: [docs/status.md](docs/status.md) and
[docs/verification.md](docs/verification.md).

## Repository map

- `web/`: the frontend (`src/`, `scripts/`, `tests/`).
- `crates/`: [protocol, core, web, host, xtask](crates/README.md).
- `index.html`, `static/`, `Cargo.toml`: the Trunk entry, stylesheets and
  icons of the earlier interface (the icons are also copied by `web/`).
- `docs/`: [documentation index](docs/README.md).

## License

See [LICENSE](LICENSE).
