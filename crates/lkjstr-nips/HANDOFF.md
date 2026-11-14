# Handoff

## Scope and design

All implementation, tests, fixtures, API documentation, and verification
support live in this new crate. The only existing-file change is adding
`crates/lkjstr-nips` to root `Cargo.toml` workspace members. No application
crate is imported, replaced, or modified. Changes are uncommitted.

Protocol codecs and policy are pure functions with explicit errors. Time,
randomness, LNURL provider identity, search matching policy, and HTTP are
caller-owned inputs. There are no network, filesystem, thread, system-clock,
or OS randomness calls in the library. The WASM normal dependency graph has
no `getrandom` package.

Uses existing workspace dependencies where possible: base64, bech32, k256,
serde, serde_json, sha2, and url. Adds ChaCha20 and direct HKDF/HMAC/zeroize
dependencies for NIP-44; these are pure Rust. ECDSA support uses the same
k256 curve library for signed BOLT11 inspection without a C dependency.
Cryptographic key wrappers redact Debug and zeroize their owned bytes.
NIP-44 has an explicit 1 MiB plaintext memory cap per encryption layer.

Outbox routing is deterministic greedy weighted set cover with a relay
budget and explicit uncovered authors. Scoring keeps constant-size decayed
statistics and computes capped backoff/hedging decisions without timers.
Search matching requires an explicit policy because NIP-50 is relay-defined.

NIP-59 verifies both signed layers, rumor IDs, author equality, and recipient
routing. Kind-14 DM helpers also enforce actual participant membership.
Private NIP-51 lists use NIP-44 to self and preserve opaque ciphertext until
explicitly decrypted. BOLT11 inspection validates invoice signatures and zap
bindings; it does not perform Lightning payments or prove payment status.

## Verification results

Run from the worktree root with Cargo/Rust in PATH:

```sh
sh crates/lkjstr-nips/verify.sh
```

Final run passed:

- `cargo fmt --manifest-path .../target/harness/Cargo.toml -- --check`.
- `cargo clippy --manifest-path .../target/harness/Cargo.toml --all-targets -j 4 -- -D warnings`.
- `cargo test --manifest-path .../target/harness/Cargo.toml -p lkjstr-nips -j 4`:
  **62 tests and 5 documentation examples passed**, no failures or ignored tests.
- `cargo build --manifest-path .../target/harness/Cargo.toml -p lkjstr-nips --target wasm32-unknown-unknown -j 4`.
- `sh -n crates/lkjstr-nips/verify.sh` and `git diff --check` passed.
- All new Rust/docs files are at most 200 lines; whitespace/newline checks
  passed. Root `Cargo.lock` bytes equal `HEAD:Cargo.lock`.

The standalone validation workspace links the actual crate source/tests and
copies its manifest, adding only `[workspace]`. This keeps all caches,
dependency lock resolution, logs, and artifacts in git-ignored `target/`
inside this crate. Builds and test threads were capped at four.

Official vector provenance and illustrative upstream example defects are
documented in `tests/vectors/README.md`. The full BIP-340 and NIP-44 vector
suites pass, with current extended-length NIP-44 vectors tested separately
from superseded historical invalid size cases. Generated adversarial and
property-style tests are distinguished from official vectors.

## Unverified integration and next step

No production, deployment, SSH, real relay, HTTP endpoint, browser, Docker,
or workspace-wide product gates were used. Browser adapters, storage, UI,
relay publication, and wallet flows are not part of this library change.

The orchestrator should resolve the root lockfile for the new workspace
member and run the relevant integration/workspace gates when composing the
concurrent branches. API examples and `README.md` describe host obligations,
including fresh CSPRNG wrapping inputs and NIP-05 redirect prevention.
No parity, cutover, or retained-code deletion is claimed.
