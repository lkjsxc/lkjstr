# lkjstr

## Purpose

lkjstr is a browser-only, local-first Nostr client with a tiled workspace.
Timelines, threads, profiles, notifications, search, composer, media, relays
and settings run entirely in the browser. There is no lkjstr backend.

## Parts

- `web/`: the only interface, TypeScript without a framework. It draws and
  never parses events, opens sockets or touches the event store.
- `crates/lkjstr-engine-worker/`: Rust/WASM Worker and browser effects.
- `crates/lkjstr-core/`: deterministic engine policy, store and native tests.
- `crates/lkjstr-protocol/` and `crates/lkjstr-nips/`: codecs and cryptography.
- `web/src/engine/protocol.ts`: the additive engine/interface contract.
- `engine/`: Worker loading and transport glue.
- `static/`: shared icons and manifest copied into the frontend build.

The root Cargo.toml is a virtual workspace. The former Leptos interface,
root HTML entry and Trunk build have been removed.

## Run and build

Requirements: Node 24, pnpm 11, the Rust toolchain in rust-toolchain.toml,
wasm32-unknown-unknown and wasm-bindgen-cli 0.2.122. Put wasm-bindgen on PATH
or set LKJSTR_WASM_BINDGEN to its absolute path. No Trunk is needed.

```sh
pnpm install
pnpm --dir web install
pnpm dev                    # frontend development with the mock engine
pnpm build                  # web/ plus real Worker engine into dist/
pnpm --dir web serve        # static preview with production headers
pnpm --dir web smoke:real   # loopback real-engine browser check
pnpm --dir web package      # current dist/ archive in tmp/
```

The mock remains a development and test double for this same interface.
`pnpm --dir web build` builds that variant; build:real builds the real engine.
The static host requirements are in [hosting-needs.md](docs/hosting-needs.md).

## Verification

On shared hosts set CARGO_BUILD_JOBS=4 and RUST_TEST_THREADS=4. With restricted
writes, put Cargo, browser and temporary caches under ignored tmp/.

```sh
pnpm check:repo
pnpm test:quiet
pnpm rust-wasm:quiet
pnpm verify:quiet
sh scripts/engine-check.sh
pnpm --dir web check
pnpm --dir web build
pnpm --dir web smoke
pnpm --dir web build:real
pnpm --dir web smoke:real
```

Root release gates build the sole frontend with the real engine. Automated
browser checks use loopback relays and local data. Docker Compose verify is
the final gate where Docker is available; it is not available in this session.

See [docs/README.md](docs/README.md), [status.md](docs/status.md),
[verification.md](docs/verification.md) and [engine-polish.md](docs/engine-polish.md).

## License

See [LICENSE](LICENSE).
