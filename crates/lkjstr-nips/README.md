# lkjstr-nips

Pure Rust Nostr codecs, cryptography, and client policy. This crate has no
dependency on the application crates, networking, threads, OS randomness, or
system time. It does not change shipped product behavior.

All timestamps are Unix seconds; scoring latency and scheduler delays are
milliseconds. Callers supply cryptographically secure fresh nonces, Schnorr
auxiliary randomness, one-use wrapping keys, and independently randomized
seal/wrap timestamps. Public examples use deterministic test inputs only.
Secret key and conversation key wrappers redact Debug and zeroize on drop.
Explicit nsec encoding is a secret export operation for host-controlled UI.

## API map

| Module | Contracts |
| --- | --- |
| `event`, `filter` | NIP-01 serialization, hashing, BIP-340 signatures, exact filters |
| `entity`, `thread` | NIP-19/21 entities, NIP-10 threads, NIP-27 byte-offset mentions |
| `relay`, `scoring` | NIP-65 metadata, bounded greedy outbox cover, relay policy |
| `lists`, `metadata` | NIP-02/51, NIP-11, NIP-36, NIP-40 |
| `list_crypto` | NIP-44 self-encryption for private NIP-51 entries |
| `identity`, `auth` | NIP-05 injected HTTP and NIP-42 |
| `nip44`, `gift`, `dm` | NIP-44 v2, NIP-59, NIP-17 kind-14 messages |
| `actions`, `zap`, `invoice` | NIP-25/18, NIP-57 and signed BOLT11 invoices |

Parsing metadata does not authenticate an event: call `Event::verify` at
ingress. APIs which depend on authenticity (unwrap, zap validation, repost
validation) verify internally. Filter `matches` returns an error for NIP-50
search unless the caller supplies a search predicate; search semantics belong
to the relay. Limits apply to initial queries, not live matching.

NIP-51 parsing preserves private ciphertext. `list_crypto` explicitly encrypts
and decrypts private entries using NIP-44 to self; historical encryption
formats fail explicitly. NIP-17 hosts must obtain kind-10050 inbox relays before publishing,
and wrap separately for every participant including the sender.

NIP-05's HTTP adapter must disable redirects, enforce TLS, and bound response
sizes. Verification checks status and final URL as well as the name binding.
Zap validation checks provider identity, signed request and receipt, target
consistency, signed invoice amount/description hash, and optional preimage.
A receipt attests what its LNURL provider says; it cannot prove payment.

## Sources and vectors

Protocol source: <https://github.com/nostr-protocol/nips>. Vector provenance,
hashes, and the distinction between official examples and generated tests are
recorded in `tests/vectors/README.md`. Tests are offline after dependencies
are available. Source and test files stay below the repository's 200-line cap.

## Verification

Run `sh crates/lkjstr-nips/verify.sh` with Cargo/Rust in PATH. It runs format,
Clippy, tests/doc examples, and the WASM build when the target is installed,
with at most four build jobs and four test threads. The script copies only the
package manifest and links the real source/tests into a git-ignored standalone
workspace under this crate's `target/`. Caches and artifacts stay there.
This avoids changing the root lockfile, as required by this task's isolation
contract. Normal workspace integration will require resolving the root
`Cargo.lock` for the added member. Repository-wide gates and browser/network
integration are outside this crate's verification claim.
