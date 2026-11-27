# Cache retention and reload

## Purpose

Shared weighted retention keeps visible public data useful across Home views and reloads.

## Home semantics

Home uses the selected account's verified follows and includes that account. Their Home
uses its target's verified public follows and includes that target. Reader mutes and other
visibility rules still belong to the reading account; Their Home additionally uses its target's public mute list. Being a Their Home target never
makes someone a saved account or imports their private policy.

Visible row authors, repost actors, reply authors, mentions and quote authors contribute
reuse weight. Their cached profiles receive access stamps before a pressure pass. A
visible Their Home's kind-3 and kind-10000 are held read dependencies; other target lists gain no owner pin.

## Metadata checkpoint

One shared checkpoint keeps at most 4000 verified replaceable/deletion rows and 4 MiB
including access hints. Its victim scores use the same integer GDSF scorer as memory,
with a resource-specific inflation clock and exact serialized record costs. Hints affect
reuse only; they cannot grant signature verification or deletion authority.

Each ordinary event/context transaction merges current visible metadata and account/read
dependencies with the existing checkpoint. NIP-01 revision order and author-bound signed
deletions precede reuse selection. Stale writers cannot replace newer metadata. Required
deletion evidence and verified dependencies are never silently dropped. If their bodies
exceed the inline budget, the transaction uses exact verified body references within the
durable budget. A genuine total proof floor preserves committed authority and backpressures.

The proof set keeps the newest sufficient signed witness per event target and possible
deleting author, or valid author/address coordinate. Unknown targets can still name old
disk rows, so they remain relevant. Empty or proven-foreign controls do not consume this
proof set. Access hints cover retained metadata authors, not entire absent follow graphs.

Startup restores the complete checkpoint, including required references, before the
newest 2000 event rows and view opens. [Durable GDSF](durable-cache.md) now uses the shared
resident planner, bounded pressure epochs and transactional victim/inflation commits.
Independent 20000-row timestamp pruning has been removed.

## Qualification

Native controls cover target-self membership, target follow-list dependencies, visible
profile access, stale writers, deletion authority, exact checkpoint byte/count bounds and
required-evidence overflow. The private real-Worker fixture uses warm IndexedDB, ordinary
production artifacts, signed loopback events and an 800 ms profile-response delay for both
Home sources. Measurements and artifact paths accompany the private handoff.

## Project lesson

Owner: engine/cache maintainer. A byte bound must measure its owned representation, and a
metadata retention check must exercise an actual committed checkpoint under mixed-kind
pressure. Ordinary row freshness does not prove that old names survive a reload.
