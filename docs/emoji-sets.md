# Referenced emoji sets

## Purpose

Record the Core discovery and projection used by the existing emoji picker.
No new layout, visible words, action or wire shape is required. This isolated
implementation has native evidence; real Worker checks are still pending.

## Authority and selection

The selected account's newest verified public kind-10030 list is the only source
of membership. Its direct emoji tags remain first. Valid kind-30030 coordinates
in its public `a` tags select referenced sets. Unrelated cached sets, another
account's list, private ciphertext and a set's own references grant no authority.

Discovery requests each exact author and identifier with kind 30030. An optional
validated relay hint belongs only to that coordinate. It does not change saved
read/write permissions. Existing configured routes, transport limits, verification,
deadlines and cancellation perform the effects. Hiding or closing the picker
releases its wants. Once a newer owner list is verified locally, it immediately
withdraws removed references. Both lookups remain finite: closing and reopening
the picker refreshes them; this is not a live cross-device list watcher.
An old cancelled wire response cannot restore membership.

One indexed retained-store scan selects the newest event for each requested
author/identifier. Equal timestamps choose the lowest lexical event ID. The
first `d` tag determines the identifier. An unchanged cached event can be used
while a lookup is pending; cache presence does not establish global freshness.

Direct shortcode entries win over referenced sets. Sets then follow the current
owner-list order; the first set containing a shortcode wins. Within one event,
the last valid duplicate retains the earlier direct-entry behavior. Shortcodes
and HTTPS image URLs use the existing protocol validator. Its outgoing code
validator now accepts the same NIP-30 hyphens as its incoming path, so selecting
a valid hyphenated code retains its tag in notes, reactions and private drafts.
Referenced row `set` contains the bounded title, or the identifier when no title exists. Row keys stay
`emoji:<code>`, so an update changes the existing row rather than duplicating it.

## Bounds and unavailable data

| Resource | Bound |
| --- | --- |
| Referenced coordinates | First 32 distinct valid coordinates per owner list |
| Picker rows | First 400 distinct shortcodes, direct entries first |
| Parsed emoji/reference tags | First 4,096 per list or set |
| Coordinate identifier | Nonempty, at most 256 UTF-8 bytes; rejected rather than cut |
| Shortcode / image URL | At most 64 / 2,048 bytes before protocol validation |
| Set title | At most 256 UTF-8 bytes, cut at a character boundary |
| Relay hint | Existing strict relay validation and 24-transport engine bound |

These collections are rebuilt from bounded retained data and are released after
planning/projection; there is no global emoji catalog or recursive discovery.
The retained event store and at-most-128-view limits still apply.

Unavailable sets contribute no invented rows. Successful empty EOSE can finish
an absent reference only after verification drains. Refusal, timeout, an invalid
event occupying a response slot or verification debt cannot establish completed
empty membership. A cached valid set remains usable despite a route failure.
A full row budget, excess references, a tag-scan cutoff or an over-budget
identifier/shortcode/image URL keeps exhaustion unknown. A lone skipped value
cannot become a completed empty result. Invalid small values and recursive set
references remain ignored. The existing picker consumes rows but has no per-set
failure/retry surface.

Encrypted list/set tags, set browsing/editing, recursive references and propagation
of a selected set address into outgoing emoji tags are outside this change.
The existing composer continues to publish the selected code and image URL.

## Verification

On 2026-11-16 at 14:45-14:47 UTC, the unchanged runtime failed all 13 new
native cases; the implementation passed all 13 after two fixture corrections
(reconnect notification and unique outstanding action IDs). The original failure
and intermediate logs remain under `tmp/emoji-proof/`. Existing NIP-30/NIP-51
cases and strict focused Clippy also pass. Initial load was 0.83/1.36/2.01;
four build jobs and test threads were used.

Two old protocol assertions rejected outgoing hyphens. They now assert acceptance
because the current NIP-30 permits hyphens, rather than weakening valid-name checks.
The new note/reaction/private-rumor case proves the selected code retains its tag.

At 16:16:58-16:17:11 UTC, the bounded-value follow-up failed all five isolated
over-budget coordinate/code/URL cases against the prior emoji implementation;
the exact-boundary and invalid-value controls already passed. The corrected
implementation passed all seven cases and the original 13. The command block
took 13.508 seconds, at load 2.16/1.62/1.48 to 2.71/1.77/1.53, with four build
jobs and test threads. Logs and source hashes are in
`tmp/emoji-limits-proof-try2/`. The initial shared-target run reused stale
artifacts; its unexpected results remain in `tmp/emoji-limits-proof/`. Refreshing
only Core/protocol source timestamps forced the intended source into both proof
phases. No runtime or assertion changed between those runs.

The follow-up has not rerun strict Clippy; its native proof does not replace the
pending Worker and full integration gates.

The authored real Worker fixture is registered in `scripts/engine-check.sh` but
has not run. WASM, full integration gates and a public post-change measurement
remain unrun; this checkpoint is not a completed feature landing.

Primary specifications checked on 2026-11-16:

- https://github.com/nostr-protocol/nips/blob/master/51.md
- https://github.com/nostr-protocol/nips/blob/master/30.md
