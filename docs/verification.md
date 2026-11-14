# Verification

## Purpose

The gates, how to run them on a shared host, and what was actually checked.

## Quiet gates

Each prints one `ok <name>` line on success and a bounded tail on failure.

| Command | Runs |
| --- | --- |
| `pnpm check:repo` | doc shape, line limits, Rust style rules |
| `pnpm test:quiet` | fmt, clippy (native and wasm32), `cargo test --workspace` |
| `pnpm rust-wasm:quiet` | the above plus `trunk build --release` and `check-dist` |
| `pnpm verify:quiet` | repo checks plus everything in `rust-wasm` |

On shared hosts cap jobs with `CARGO_BUILD_JOBS=4` and `RUST_TEST_THREADS=4`.
When caches must stay in the worktree, use ignored `tmp/` directories for
`CARGO_HOME`, `XDG_CACHE_HOME`, `XDG_DATA_HOME`, `XDG_CONFIG_HOME` and `TMPDIR`.
Seed the Cargo registry and Trunk tool cache from existing read-only caches
if needed. Keep `PATH` pointed at the installed Rust tools.

## Docker (final gate)

```sh
docker compose --progress quiet -f docker-compose.yml build verify
docker compose --progress quiet -f docker-compose.yml run --rm verify
```

The `app` target serves the release build on `127.0.0.1:8418` for previews.
Docker verification remains pending when writes outside the worktree are
forbidden: building an image writes to the Docker daemon's storage.

## Browser checks

Build first, then run `pnpm smoke:browser [out-dir]` (default `tmp/smoke`).
It serves `dist/` on a free loopback port and uses a fresh Chromium context.
Every WebSocket terminates at an in-process fake relay; external HTTP is
blocked. It never connects or publishes to public relays. The server and
browser close after the run; existing services are untouched.

Requirements: Playwright Core from `pnpm install --frozen-lockfile`, Chromium,
and the installed Rust toolchain. Set `LKJSTR_CHROME` to choose the browser
binary, or use the existing Playwright Chromium cache. Set `LKJSTR_DIST` to
serve an extracted tarball instead of `dist/`.

Checks cover:

- Create a local key, invalid import, npub read-only import, switch, remove,
  persisted account and rejection of read-only posting by keyboard.
- Compose, sign, publish to the fake relay, open a thread, reply and like.
  The native protocol helper verifies every submitted id and signature.
- Empty and populated Notifications, signed profile metadata and author notes.
- Cached text search, a NIP-50 result absent from the cache, empty completion,
  relay refusal, and npub, nprofile, note and nevent navigation.
- Feed rows clear when switching accounts; layout, account and cached events
  survive reload with relay event replay disabled.
- Keyboard splitting and focus, narrow single-tile mode, static asset HTTP
  responses, and absence of page errors.

`browser-relay.mjs` bounds fake relay events, publications, searches and
subscriptions. `lkjstr-protocol/examples/browser-fixtures.rs` generates a
fresh in-memory fixture key and emits public signed events only. Browser
keys are generated locally; the smoke never reads or exports their secrets.
JSON results and screenshots go to the output directory. A failure exits
non-zero. Browser checks are separate from the quiet gates because Chromium
must be present.

## Record

2026-11-14, revive branch:

- Current expanded smoke: all 33 checks passed on the debug build and again
  on the extracted release tarball, with external HTTP blocked and every
  WebSocket intercepted. Reports: `tmp/smoke-fixed/report.json` and
  `tmp/smoke-release/report.json` (ignored local artifacts).
- Found and fixed search remaining in loading after EOSE or relay refusal,
  and Home and Notifications retaining rows across account switches.
- Native regression covers clearing shown rows, pending arrivals and dedup
  state while preserving the timeline cap.
- Current `pnpm check:repo`, `pnpm test:quiet`, `pnpm rust-wasm:quiet` and
  `pnpm verify:quiet` passed. `pnpm build` also passed with `NO_COLOR=1`.
- `tmp/lkjstr-dist.tar.gz` contains the checked release static site (about
  1.1 MB compressed); the release WASM is 9393153 bytes (995679 bytes gzip).
- Docker verify: not run under the worktree-only write restriction.
- Previous read-only public-relay checks exercised Global, Thread and Profile.
  No public relays were contacted in this verification run.
- Not exercised: NIP-07 extension, nsec import, explicit key backup, large
  IndexedDB pruning, and scroll restore (previous check failed).
