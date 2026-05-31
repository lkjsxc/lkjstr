# Feed Coverage Correctness

## Purpose

Feed coverage correctness defines when durable coverage can prove a bounded
cache-first interval and when it must be removed or ignored.

## Proof Rule

Coverage proves a bounded feed interval only while all of these remain valid:

- required relays
- route groups
- semantic feed key
- filter shape
- interval bounds
- backing event availability
- required event-relay receipts

Dense, incomplete, unresolved, failed, stale, compacted, or missing evidence is
not proof of absence and cannot suppress relay reads.

## Compaction Rule

Event compaction must invalidate coverage that could depend on deleted event
evidence. Correctness beats retaining coverage cache.

Current implementation uses conservative invalidation: event compaction deletes
all feed coverage rows. Coverage is recoverable derived cache, and relay reads
can rebuild proof.

## Implementation Target

Future precision may collect deleted-event shape to remove fewer matching rows.
Until that exists, deleting all coverage after event compaction keeps
cache-first rendering from trusting stale proof.

## Verification

Tests must prove complete coverage is useful before event deletion and cannot
prove absence after its backing event repository evidence is compacted.
