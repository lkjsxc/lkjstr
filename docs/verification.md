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

- Workspace-review regressions in `scripts/browser-workspace-review.mjs` cover
  switching workspaces while zoomed, closing the zoomed tile, and unanswered
  manual quote/repost loads releasing on tab hiding, other-tile zoom and narrow
  mode. Showing a tab resumes its requests. Native `spaces_test` checks unique
  IDs after moves, resets, recovery, reloads, imports and last-tab replacement.

`browser-relay.mjs` bounds fake relay events, publications, searches and
subscriptions. `lkjstr-protocol/examples/browser-fixtures.rs` generates a
fresh in-memory fixture key and emits public signed events only. Browser
keys are generated locally; the smoke never reads or exports their secrets.
JSON results and screenshots go to the output directory. A failure exits
non-zero. Browser checks are separate from the quiet gates because Chromium
must be present.

## Record

2026-11-14, workspace identity and visibility review:

- All 107 browser smoke checks pass, including nine workspace/visibility checks.
  Report: `tmp/smoke-workspace-review/report.json`.
- Native `spaces_test` adds five regressions for allocation after moves/reloads,
  fresh reset identities/recovery, colliding saved banks, import reservation and
  last-tab moves. Imported layouts and focus history were audited too.
- All four quiet gates pass with jobs/test threads capped at four and caches
  inside the worktree. Docker remains excluded by the worktree-only write rule.

2026-11-14, Phase B partial delivery:

- All four quiet gates pass after the final product changes: repo, test,
  rust-wasm and verify. Jobs and native test threads were capped at four;
  Cargo, Trunk, browser and temporary caches stayed in ignored worktree paths.
- All 98 release smoke checks pass against `tmp/phase-b-unpacked`, extracted
  from the final `tmp/lkjstr-dist.tar.gz`. Report:
  `tmp/smoke-phase-b/report.json`. The storage-failure check explicitly opens
  Welcome because a fresh visitor now starts on Global.
- The design suite passes 439 checks with 92 PNG captures. It covers tab close
  visibility, middle close, focus order, rapid closing, menu duplication/pins,
  drag cancellation, workspace switching/movement/reload, gallery dimensions,
  whole-line folds, media loading, notification/repost actor targets, background
  middle click, settled counts, offline status and data saver.
- Every existing view is checked at widths 160, 200, 320, 520 and 900px with a
  160px tile height in both themes. Deliberately truncated metadata and the
  horizontally scrolling tab list are excluded from body-overflow assertions.
- Captures at 1440x900 and 390x844 in both themes, plus four tile width classes
  in each desktop theme, are listed in `tmp/screens/INDEX.md`. Results are in
  `tmp/screens/report.json`. Signed mixed-language fixtures include data URL
  avatars, sized/gallery images, replies, reposts, quotes, custom reactions,
  long text, content warnings, audio and video. External HTTP/WS are intercepted.
- The daily-use review records 60 observed frictions in `details.md` (44 fixed,
  16 open). The final static archive follows the README BUILD commands.
- Rapid disposal exposed a queued fold callback; its release guard and safe
  completion handling for scroll, draft and account UI loads pass the final suite.
- The final design copy includes the upstream 12:55 Addresses/Language update;
  the late full-width rule is applied. Clean paths and the string guard are open.
- Docker verification remains excluded by the worktree-only write rule.
  No deployment, commit, production access or existing service restart occurred.

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

## Phase C corrections

All four quiet gates pass. The release and extracted archive each pass 117 smoke
checks; the design
suite passes 629 checks with 166 PNG captures. Reports are in
`tmp/smoke-phase-c/report.json` and `tmp/screens/report.json`. Browser suites use
signed mixed Japanese/English content, data URL avatars, image dimensions,
replies, reposts, quotes, custom reactions, long notes and content warnings.
Captures include all existing views in both themes at 1440x900 and 390x844,
Japanese-browser views, and 200/320/520/900/1400px width samples.

The size suite checks every existing view at 160, 200, 320, 520, 900 and 1400px
width and 160px height, horizontal overflow, available text measure and inactive
close visibility. The tab suite exercises closing, focus order, duplicate views,
pinning, rapid closing, Escape drag cancellation, arrow keys and 40px resizing.

Keyboard and narrow-screen results are historical; assistive-technology and
complete touch testing remain open. See design-review.md for conflicts.

The address suite checks root/default behavior, ignored old hashes, focused
public paths, titles, replace/push history, layout-preserving deep links,
unsupported routes and refusal to search secret keys. Native tests enforce the
language table boundary, independent previews and physical resize constraints.

Docker Compose verification cannot run under the explicit instruction to write
only inside this worktree: it writes image and container data to daemon storage.
No service was stopped/restarted, no commit made, and no deployment performed.

Prior layout/navigation review: 129 browser checks passed (2026-11-14).

## Worker engine (2026-11-14)

All 33 native engine tests pass, including 13 review regressions. All 18
headless Worker checks pass against a fresh loopback WebSocket, including
content-derived signing tags and SharedWorker answered-relay progress.
Report: tmp/engine-harness/report.json. Final verify:quiet passes (fmt,
native/WASM clippy, workspace tests, release build and output checks), with
jobs/threads capped at four and caches inside the worktree. Docker remains
excluded by the worktree-only write restriction.
