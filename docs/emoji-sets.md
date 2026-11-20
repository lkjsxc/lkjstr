# Referenced emoji sets

## Purpose

Record the Core discovery and projection used by the emoji picker. Existing
native and real Worker conformance cover membership, replacement and bounds.

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
Referenced row `set` contains the bounded title, or the identifier when no title
exists. Row keys are `emoji:<code>`. The optional `address` identifies the
containing set. A direct entry can carry a valid address from its own emoji tag.

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

Public drafts emit one tag per used, validated shortcode. Custom reactions emit
one tag for their exact `:shortcode:`. Both include the optional set address when
supplied. Profile names and bios read tags from their signed kind-0 metadata.
Notes and reactions use their own signed tags. Reaction removal can match the
displayed image so two reactions using the same shortcode can be removed separately.
Encrypted list/set tags, set browsing/editing and recursive references remain
outside this flow. DMs send the selected code and URL in their encrypted rumor.

## Verification

The 2026-11-20 loopback fixture checks the picker coordinate and the images
selected by signed metadata, note and reaction tags when all use the same
shortcode as the picker. The signing fixture covers accepted custom emoji
notes and kind-7 reactions with the coordinate. Native cases cover unused
draft entries, duplicate shortcodes, invalid coordinates and literal URLs.

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

The combined native/all-target strict Clippy, WASM, repository and frontend
check/build/smoke gates passed on source 274fd7e0. The all-target pass includes
the bounded-value tests. These records are in the combined worktree's
`tmp/release-gates.json`; the later conformance completion is recorded below.

The first combined Worker gate stopped in the emoji fixture HTTP server:
it sent 200 headers before reading a missing file, then threw while attempting
404. This was a fixture failure before the emoji assertions, not a product
regression. Commit 0bbf832a reads the body before choosing headers; no runtime
or assertion changed. The complete short failure tail is retained in
`tmp/release-engine-try1.log`; the ordinary fixture log was reused afterward.

The corrected finite fixture passed all eleven checks at 18:38:56 UTC in
1.304 seconds, load 1.87/2.43/2.76. It covers verified set discovery, exact
coordinates, pending completion, invalid signatures, existing row shapes,
direct-entry precedence, refreshed withdrawal and account isolation. The
unchanged protocol contract passed with zero browser errors, forbidden relay
operations or request-record drops. Browser, signer, server and profile cleanup
completed; the owned-process ledger and a scoped scan found no leftover browser.

The harness WASM is
`d0190ae85b266cfa8dfc4b50eaf4848c5c85811eae86b894ec422427432beb9c`.
Its immutable package is under `tmp/release-artifacts/aeede028a9d360bd0c65`;
the report is `tmp/release-reports/emoji-try1/engine-emoji/report.json`.
The lasting fixture remains registered in `scripts/engine-check.sh`.
Full combined conformance and default real interface smoke passed on 9766cd1a;
see [engine-variants-verification.md](engine-variants-verification.md).
The next required public hour remains separate.

Primary specifications checked on 2026-11-16:

- https://github.com/nostr-protocol/nips/blob/master/51.md
- https://github.com/nostr-protocol/nips/blob/master/30.md
