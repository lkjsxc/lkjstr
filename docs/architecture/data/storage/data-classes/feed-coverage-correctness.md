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

If precise dependency tracking is unavailable, use conservative invalidation.
Deleting all coverage after event compaction is acceptable because coverage is
recoverable derived cache.

## Implementation Target

The event delete path should collect enough deleted-event shape to remove
matching coverage rows. Until that shape is complete, delete all affected feed
coverage rows after event compaction so cache-first rendering schedules relay
reads for uncovered intervals.

## Verification

Tests must prove complete coverage is useful before event deletion and cannot
prove absence after its backing event repository evidence is compacted.
