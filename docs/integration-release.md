# Frontend release integration

## Purpose

Record the first TypeScript frontend build using the real Rust/WASM engine,
its release candidate, verification and the remaining UI ownership decisions.

## Item results

1. Done: protocol-additions.patch is applied and the mock handles relay,
   heartbeat, detach and public-key messages. Mock tests and browser smoke pass.
   Quote lookup errors have localized English/Japanese text and a rendering
   regression. Thread projection has ancestor roles and parent-based depths,
   covered by two native regressions.
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

- Review: web/ check and build pass, including TypeScript, Biome and 39 tests
  in five files. Smoke passes; thread shots pass all 12 language/theme/width
  combinations, with desktop English and mobile Japanese captures inspected.
  The missing quote.error check failure is fixed.
- Review: check:repo, test:quiet, rust-wasm:quiet and verify:quiet pass.
  All three added regressions failed against the original projection/strings.
- scripts/engine-check.sh: all 54 conformance checks pass against the current
  worktree contract, without fetching an external branch.
- Docker was not attempted: daemon storage would violate the worktree-only
  write restriction.
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

- Accounts: closed by the interface slice below. A person can sign in, add,
  switch and remove accounts, and is signed out again when none is left.

## Interface slice, 2026-11-15

The interface now carries the whole account surface and the first minute of
a visit; docs/design.md has the rules. In short: an Accounts tab (extension,
key or address, new account; switch; remove; back up key), a visitor's own
layout (one tile of Global, Sign in on the bar), publishing controls drawn
off for a reader who cannot write, short npubs in place of unknown names,
no count before it is known, picture boxes with their final shape and a
tint, relay editing in Settings only, a phone bar that fits.

Protocol changes (web/src/engine/protocol.ts) for the engine to follow:

1. The protocol number (the constant at the top of the file) is 2. New
   action `account.key {pubkey}`: the result carries `key`, the `nsec1...`
   of a `local` account; any other signer fails with `unsupported`. The
   engine reports 2 in `ready` once it answers this action. Until then the
   interface hides "Create a new account" and "Back up key", so no key is
   made that cannot be shown.
2. `ProfileRow.following`, `followers` and `notes` are optional: absent means
   not known yet. A partial 0 is treated the same way.
3. `Author.name` may be empty, the pubkey or the npub until the profile is
   known; the interface shows a short npub in its place. No field was added.
4. `EngineConfig.mock.accounts: 'none'` (mock only): a first visit.

Asked of the engine, with no protocol change: `Counts.partial` and
`ProfileRow.partial` are always true today, so every count reads "1+" for
good; they should turn false once the relays asked have answered. A link's
`text` should be the host and a shortened path. A visitor cannot change
bootstrap relays (`relays.save` needs an account).

Gates in web/: pnpm check, pnpm build, pnpm smoke, pnpm smoke:real all pass.
smoke:real has 27 checks and now signs in through the interface (fixture
extension, and a throwaway key made in the test and used on loopback only),
covers read-only, switching, removal, signing out and the signed-out first
run. LKJSTR_SHOTS=1 makes it write the review captures.

Captures in ignored tmp/screens/ (earlier ones moved to tmp/screens-earlier/):
slice-firstrun-1440.png (public relays, signed out), slice-signin-390-dark-ja.png,
slice-profile-pending-1440-dark.png, slice-signedin-1440-ja.png (loopback).

Release candidate: ARTIFACT_LINE

## Files

Plumbing changes are in web/src/engine/, startup imports in web/src/main.ts,
web/scripts/, engine/transport.js, scripts/engine-*, and the core/Worker crates.
Regression tests are engine_frontend_test.rs, engine-startup.test.ts and the
mock tests. Build, host requirements and status docs describe the real build.
Review corrections add the two quote-error strings and thread projection
regressions. No CSS, component markup, icons or CI workflows were changed.
No commit, deployment or production access was performed.
