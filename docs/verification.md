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
- Review regressions in `scripts/browser-review.mjs`: storage open, write and
  transaction-abort failures with atomic rollback; modified note actions;
  replies blocked until the parent arrives; reactive repost targets; missing
  thread completion/refusal; noise-only pages and tied timestamps; accepted
  AUTH reissuing requests; completed session wants releasing sockets.
- Second-review regressions in `scripts/browser-review-2.mjs`: previous schema
  18 storage isolation, synchronous event write failure and transaction abort
  with retry, socket construction failure with backoff/retry, content-only
  quotes with relay hints, live remote deletions in feeds/threads, and extension
  event substitution. Native tests also cover bounded persistence, every signer
  field, invalid IDs/signatures, quote/mention edges and large text spans.
- Foundation-review regressions in `scripts/browser-foundation-review.mjs`:
  a healthy live feed receives new signed events after silent peers time out;
  image retry sends a second request and loads it, surviving the next deadline;
  ancestor tags affect neither reaction chips, Like selection nor repost target.
  Native `request_deadline_test` covers shared requests, reconnects and release.
  Explicit retry also requeues completed and shared one-shot lookups, retaining
  healthy live subscriptions and unrelated requests. `invoice_signature` checks
  low/high-S invoices with explicit/recovered payees, tampering and zap receipts.
  `browser-navigation-review.mjs` checks Back/Forward after reload and discovery
  of later search/thread results on explicit retry after empty EOSE completion.
  `review_foundation_test` covers unchanged preview activation, target ownership
  and pane recovery at the 32-entry cap, including grouped layout undo.

`browser-relay.mjs` bounds fake relay events, publications, searches and
subscriptions. `lkjstr-protocol/examples/browser-fixtures.rs` generates a
fresh in-memory fixture key and emits public signed events only. Browser
keys are generated locally; the smoke never reads or exports their secrets.
JSON results and screenshots go to the output directory. A failure exits
non-zero. Browser checks are separate from the quiet gates because Chromium
must be present.

## Record

2026-11-14, history/retry/invoice review:

- All 98 release browser smoke checks pass, including eight new history/retry
  checks. Report: `tmp/smoke-navigation-review/report.json`.
- Four new native regressions pass: retry state/membership preservation,
  low/high-S invoice payees, high-S zap receipts and tampered high-S signatures.
- Before fixes, the added browser checks reproduced lost reload position and
  both inert retries; native tests reproduced completed-request retention and
  explicit-payee high-S rejection. The related call paths were audited too.
- All four quiet gates pass. Docker verify remains excluded by the worktree-only
  write rule because Docker image builds write to daemon storage.

2026-11-14, foundation review:

- All 90 release browser smoke checks pass, including the new regressions.
  Report: `tmp/smoke-foundation-review/report.json`.
- Five new native regression tests pass; all four quiet gates pass.
- Docker verify is excluded by the worktree-only write restriction: image
  builds write to daemon storage. No existing services were stopped or restarted.

2026-11-14, Phase A foundation:

- The expanded smoke passes 80 checks on a Trunk release, including previews,
  independent tabs, neighbour placement, keeping a preview, per-tab and browser
  history, layout undo, reopening, Unicode deep links and silent-relay timeout.
  Report: `tmp/smoke-foundation/report.json`.
- `scripts/browser-foundation.mjs` seeds signed Japanese/English notes, data URL
  avatars, imeta-sized images, replies, reposts, quotes, custom reactions, long
  text and content warnings. Both themes at 1440x900 and 390x844 are captured
  under `tmp/screens/`. It asserts phone width and independent duplicate tabs.
  The complete PNG list and check results are in `tmp/screens/report.json`.
  `tmp/screens/INDEX.md` groups the captures by view, size and theme.
- Native regressions cover independent launcher/detail tabs, preview history,
  the split width floor, per-tab history bounds, layout undo, reopening after
  later edits, route parsing, data-image safety, reaction groups and exact
  theme tokens with AA contrast for readable text pairs.
- The external `docs/design.md` is preserved verbatim. Its non-ASCII text,
  missing Purpose section and 304 lines are a specific repository-check
  exception required by the owner; other documentation keeps the usual rules.
- Release WASM: 13572292 bytes (1238684 bytes gzip). The README build command
  produced `tmp/lkjstr-dist.tar.gz`; all 80 smoke checks pass on its extracted
  contents. All four quiet gates pass.
- Docker verify remains excluded by the worktree-only write restriction.

Previous revive verification:


- Second-review smoke: all 61 checks passed on the current release build,
  with intercepted WebSockets, blocked external HTTP and a fresh local port.
  Report: `tmp/smoke-review-2/report.json` (ignored local artifact).
- Earlier review smoke: all 51 checks passed on both debug and release builds with
  external HTTP blocked and every WebSocket intercepted. Reports:
  `tmp/smoke-review-debug/report.json` and
  `tmp/smoke-review-release/report.json` (ignored local artifacts).
- Fixed smoke timing: poll awaited IndexedDB counts before reloading, and wait
  for deferred REQs before delivering their fake-relay responses. The faster
  release exposed both test races; no product cache loss was involved.
- The earlier 33-check smoke passed on the extracted release tarball.
- Found and fixed search remaining in loading after EOSE or relay refusal,
  and Home and Notifications retaining rows across account switches.
- Native regression covers clearing shown rows, pending arrivals and dedup
  state while preserving the timeline cap.
- Current `pnpm check:repo`, `pnpm test:quiet`, `pnpm rust-wasm:quiet` and
  `pnpm verify:quiet` passed. These include fmt, native/wasm clippy, workspace
  tests, a Trunk release build and distribution checks.
- Current release WASM: 9622155 bytes (1052401 bytes gzip). The earlier
  `tmp/lkjstr-dist.tar.gz` predates the review fixes.
- Docker verify: not run under the worktree-only write restriction.
- Previous read-only public-relay checks exercised Global, Thread and Profile.
  No public relays were contacted in this verification run.
- Not exercised: a real NIP-07 extension, nsec import, explicit key backup, large
  IndexedDB pruning, and scroll restore (previous check failed).
