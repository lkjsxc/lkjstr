# Frontend release integration

## Purpose

Record the first TypeScript frontend build using the real Rust/WASM engine,
its release candidate, verification and the remaining UI ownership decisions.

## Item results

1. Partial: protocol-additions.patch is applied and the mock handles relay,
   heartbeat, detach and public-key messages. Mock tests and browser smoke pass.
   The frontend TypeScript gate fails at note.ts:68 because quote.error is not
   in either string table. Visible UI and wording remain untouched.
2. Done: pnpm build:real in web/ packages Rust, rewrites and hashes the engine
   dependency graph, and boots the app through the real workerTransport.
   Saved bootstrap settings are selected per account. Independent search
   usage survives read/write edits. Verified owner NIP-65 lists then take over.
3. Done: pnpm smoke:real drives the app through home/global, note/profile,
   search, compose/sign/publish, reaction, settings reload and two browser tabs.
   All 13 checks pass, including owner relay takeover across reload and another
   tab's bootstrap. The fixture extension account is created through a second
   transport port because the UI has no account-add control.
4. Done: signed-out, read-only public review opened global, a hashtag, a
   profile and a thread. No keys or publishing. First note: 1378 ms in a fresh
   context. No page errors. Shared desktop tools were unavailable; an
   interactive Playwright/Chromium session was driven and captures inspected.
5. Done: real build and smoke, then pnpm package produced
   tmp/lkjstr-dist.tar.gz. The unmodified host unpack function accepted all
   16 files, with no changes to their contents. Digest and size are below.
6. Not done: the Leptos interface and its historical gates remain. No partial
   deletion or migration was attempted.

## Gates

- web/: build and smoke pass. Vitest: 38 tests in four files pass. Biome passes.
- web/: check fails only on the missing quote.error string at note.ts:68.
- Root: check:repo, test:quiet, rust-wasm:quiet and verify:quiet pass.
- scripts/engine-check.sh: all 54 conformance checks pass against the current
  worktree contract, without fetching an external branch.
- Docker is unavailable and was not attempted.
- Jobs/test workers are capped at four. Browser profiles, caches and temporary
  paths for the new commands live under ignored tmp/.

## Artifact

- Path: tmp/lkjstr-dist.tar.gz
- Size: 724539 bytes
- SHA-256: 2467b79731e6479ee3adac82aee0120908b434988683f7cae9c61a0e42f6a4e8
- Validator: hosting repository services/lkjstr/release.py unpack, imported
  read-only with python3 -B -I. Accepted: 16 files, one valid WASM module.
  Returned file bytes exactly match the archive; no filtering or rewriting.
- Machine-readable result: tmp/release-validation.json.
- This is a reviewable release candidate; the UI gaps below remain unresolved.

## Public review

Exactly four captures are in ignored tmp/screens/:

- real-global-1440.png: 1440x900, light.
- real-profile-1440-dark.png: 1440x900, dark.
- real-thread-390.png: 390x844, light.
- real-global-390-dark.png: 390x844, dark.

Metadata and media can arrive after note text. The unfiltered global feed
contains substantial spam. Resizing an existing desktop workspace to phone
width preserves its split layout; a fresh phone context starts with one pane.
The final phone captures use that fresh layout. Public-review observations
are in tmp/public-review.json; local reports are in tmp/smoke-real/report.json
and tmp/engine-harness/report.json.

The review exposed account-only signed-out queries claiming relay failure.
They now finish empty without asking relays. Native regressions also cover
search-only relay routing, thread focus and decoded profile deep-link headers.

## UI gaps and owner decisions

- Quote state error: quoted-note cards have no localized quote.error label.
  This blocks pnpm check. The UI owner must choose its displayed failure text.
- Accounts/account.add: the top bar says Sign in, but neither its menu nor
  Settings provides a first-account control. A person cannot add a signer in
  the current interface. The owner must supply that control before signed-in
  use can be released. No account UI was designed in this integration.

## Files

Plumbing changes are in web/src/engine/, startup imports in web/src/main.ts,
web/scripts/, engine/transport.js, scripts/engine-*, and the core/Worker crates.
Regression tests are engine_frontend_test.rs, engine-startup.test.ts and the
mock tests. Build, host requirements and status docs describe the real build.
No CSS, component markup, icons, string tables or CI workflows were changed.
No commit, deployment or production access was performed.
