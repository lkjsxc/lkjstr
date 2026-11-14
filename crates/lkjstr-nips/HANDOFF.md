# Handoff

## Scope and design

The independent `lkjstr-nips` crate supplies pure Nostr codecs, cryptography,
and client policy. The review correction also fixes the existing application
NIP-19 codec in `lkjstr-protocol`; no application owner is replaced or removed.
Time, randomness, provider identity, search policy, and HTTP remain host inputs.
No product parity, cutover, payment-status, or retained-code deletion is claimed.
Changes are uncommitted.

## Review corrections

- The root `Cargo.lock` now includes the workspace member, its six additional
  dependencies, and required feature edges without updating existing packages.
  `verify.sh` checks actual locked workspace metadata before crate checks and
  uses the root lockfile throughout. The former standalone harness could pass
  while the locked Docker host build could not resolve the workspace.
- NIP-19 entities, BOLT11 invoices, and LNURLs share original Bech32 checksum
  parameters with explicit protocol length limits. The checksum library's
  default 1,023-character ceiling no longer rejects otherwise valid inputs
  below 5,000 characters or 16 KiB respectively. Checksums, case rules, canonical
  byte padding, TLVs, and invoice signatures remain validated.
- The same-class audit covered every new Bech32 call site and workspace member.
  It found and corrected the LNURL validator as well as entity encoding,
  entity decoding, and invoice parsing. The existing Rust application NIP-19
  codec had the same ceiling and now uses the full limit, with original Bech32,
  case, and canonical padding validation. TypeScript already passed its explicit
  limit to the checksum library.
- Crate and parent README indexes now satisfy repository documentation checks.
  Protocol contracts and current-state docs record the application codec fix;
  product ownership and parity statuses are unchanged.
- The Rust-style scanner now permits test-only `unwrap`, `expect`, and
  `panic!` assertions in its existing test paths, matching the functional-style
  contract. Production checks still reject these regardless of Clippy
  allowances; unfinished/debug macros remain rejected everywhere. The same-class
  audit covered all scanned crates and found no panic helpers in this crate's
  production source. The contract and xtask README document the test boundary.

## Regression evidence

Before correction, `cargo metadata --offline --locked --format-version 1`
failed with `cannot update the lock file ... because --locked was passed`.
All four initial tests in `bech32_limits.rs` failed against the original codecs.
Three long-input tests in `lkjstr-protocol/tests/nip19_limits_test.rs` also
failed against the original application codec before correction.

New tests use independent low-level standard-checksum encoding and direct
BOLT11 preimage signing with deterministic public test keys. Coverage includes
long profiles/events/addresses, NIP-21 roundtrips, exact 5,000/5,001-character
entity and LNURL boundaries, signed route-hinted invoices below/above 16 KiB,
uppercase input, checksum corruption, signed-field changes, mixed case,
Bech32m, and noncanonical padding. No real endpoint is contacted.

## Verification

Run `sh crates/lkjstr-nips/verify.sh` with Rust/Cargo in PATH. It checks locked
workspace metadata, format, crate Clippy, native tests, documentation examples,
and WASM when installed. Caches/artifacts stay in ignored
`target/nips-review/` at the workspace root; build jobs and test threads are
capped at four. Root caches avoid linting generated dependency JavaScript.

Passed:

- `sh crates/lkjstr-nips/verify.sh`: format, locked metadata, crate Clippy,
  68 native tests, 5 documentation examples, and the WASM build.
- `cargo test --offline --locked -p lkjstr-protocol -j 4`: 99 tests.
- `pnpm exec vitest run tests/unit/protocol --maxWorkers=4`: 49 tests.
- `cargo metadata --offline --locked --format-version 1` and
  `cargo build --release --offline --locked -p lkjstr-host -j 4`.
- `cargo fmt --check`, xtask `check-docs` and `check-lines`, `pnpm check:repo`,
  `pnpm test:quiet`, `pnpm rust-wasm:quiet`, `pnpm verify:quiet`, and
  `pnpm cloudflare:quiet` (local Worker smoke and deploy dry run only).
- `sh -n crates/lkjstr-nips/verify.sh`, `git diff --check`, and parsed-JSON
  equality before/after formatting six illustrative fixtures.
- `docker compose -f docker-compose.yml config --quiet`.

Original regression (reproduced before the scanner correction):

`cargo run --offline --locked -p lkjstr-xtask -- check-rust-style` reports 210
test-only `unwrap` calls in this crate, including original and new tests:

```text
crates/lkjstr-nips/tests/actions_zaps.rs: line 30 forbids unwrap call
```

Five scanner regressions now cover allowed test assertions and fixtures,
production rejection despite Clippy allowances, rejection of unfinished/debug
macros in all paths, comments/strings, and the actual repository style precheck.
The test-path and repository regressions failed against the original scanner.
After correction, all 13 xtask tests, crate Clippy, workspace format, docs/line
checks, and `check-rust-style` pass. `pnpm check:repo`, `pnpm test:quiet`,
`pnpm rust-wasm:quiet`, `pnpm verify:quiet`, `pnpm cloudflare:quiet`, and the exact
`cargo run --offline --locked -p lkjstr-xtask -- quiet docker-verify` command
also pass locally with four build jobs/test workers and worktree-local caches.

Docker image/container gates are omitted because this session permits writes
only inside the worktree. No deploy, production access, SSH, running-service
restart, or workflow edit was performed. Protocol docs, current-state docs,
and the implementation/verification ledgers record the correction; surface
parity and deletion statuses remain unchanged.
