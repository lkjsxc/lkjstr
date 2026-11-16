# Private list query ownership

## Purpose

Keep a named list's cached private members inside queries made as its signed
owner. The 2026-11-16 fix covers both returned people and profile lookup demand.
It adds no message, protocol field, interface, persistence format or ciphertext.

## Reproduced behavior

A named coordinate could select another account's kind-30000 list. The list
projection and author hydration then merged cached decrypted tags by event ID
without checking the query account. A signed-out or other-account query could
therefore return a private member and issue a kind-0 request for that member.
The registry has no named-list tab, but the engine operation was exposed.
This was an account-scope defect, not a failure of the encryption primitive.

The shared `settings::list_tags_for` helper merges private tags only when the
query account equals the signed event's author. Every reader can still receive
public tags. Both `wire/sources.rs` and `hydration.rs` use the same helper.
Bookmarks and mutes already select their list through the query account; their
behavior is unchanged. The existing authority boundary still decides which
private entries may remain cached after lock, removal or signer replacement.

No cache or background queue was added. Query-scoped cloning retains the
existing bounded list representation and does not broaden private access.

## Native reproduction

`engine_private_list_scope_test.rs` creates a signed kind-30000 event
with a self-encrypted private member and a distinct public member. It decrypts
that fixture through the existing codec, then exercises real wire sessions and
actual emitted profile filters. Only generated fixture identities are used.

Eight cases cover owner, signed-out and other-account rows and lookups, a member
also explicitly present in public tags, and revocation that preserves a second
authorized owner's list. Before the fix, all four non-owner row/lookup cases
failed; owner, public and revocation controls passed. Afterward all eight pass.
Thirteen existing private-cache, mute, bookmark and list cases also pass.

All dates below are 2026-11-16 UTC; load is one/five/fifteen minutes.

| Check | Start | Seconds | Load before | Load after |
| --- | --- | --- | --- | --- |
| Before: four of eight fail | 12:14:03 | 8.322 | 1.71/1.56/1.59 | 2.21/1.67/1.63 |
| After: all 21 pass | 12:14:27 | 4.952 | 2.32/1.72/1.64 | 2.94/1.86/1.69 |
| Strict focused clippy | 12:14:38 | 3.692 | 3.10/1.93/1.71 | 3.10/1.93/1.71 |

Raw logs and dated JSON are in the isolated private worktree's
`tmp/private-scope/{before,after,clippy}.{log,json}`. Tests use native synthetic
fixtures and publish nothing to a relay. They measure query ownership, not
external signer prompts or network delivery.

## Integration and remaining work

All seven required integration gates passed on this bounded follow-up, using
four build/test jobs. The dates below are 2026-11-16; web smoke includes 128
real upload checks and offline-shell scenarios. Documentation is checked again
after this record is completed.

| Gate | Start UTC | Seconds | Load before | Load after |
| --- | --- | --- | --- | --- |
| check:repo | 12:27:25 | 0.623 | 1.08/1.24/1.51 | 1.08/1.24/1.51 |
| test:quiet | 12:27:25 | 80.504 | 1.08/1.24/1.51 | 4.11/2.67/2.02 |
| rust-wasm:quiet | 12:28:46 | 85.267 | 4.11/2.67/2.02 | 3.65/2.81/2.12 |
| verify:quiet | 12:30:11 | 67.383 | 3.65/2.81/2.12 | 3.15/2.81/2.17 |
| web check | 12:31:18 | 5.751 | 3.15/2.81/2.17 | 3.46/2.88/2.20 |
| web build | 12:31:24 | 0.286 | 3.46/2.88/2.20 | 3.46/2.88/2.20 |
| web smoke | 12:31:24 | 375.509 | 3.46/2.88/2.20 | 2.18/2.06/2.00 |

Exact logs and load records are in the integration worktree's
`tmp/fourth-gates-20261116.json`.
Existing external-signer and historical NIP-04 private-list reading gaps remain;
that work is separate from this fix. A named-list surface still needs Claude's
specification. No saved owner account was read, converted or removed.
