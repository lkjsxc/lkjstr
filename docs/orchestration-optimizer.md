# Stage 1 orchestration optimizer

## Purpose

Document the deterministic read and retention policies and the inputs they use.

## Public reads

The Worker observes completed one-second ingress buckets and request round trips.
The estimator starts at 3,000,000 B/s and 80 ms. Throughput adapts after four
nonzero busy seconds. Until then the scheduler keeps its baseline. The last
three busy seconds set the saturation flag when
their bytes reach 85% of the throughput estimate across that window. EOSE and
first verified delivery provide round-trip estimates. First-event timing keeps
32 samples per active relay and needs 16 before it supplies a p75.

A public read starts with one to three ordinary routes. Established routes keep
their independent cursors. Focused reads can add a third primary when both top
routes have low useful share. A saturated background read can start on one
high-yield route. The additional hedge uses the quality top eight and costs the
page, round trip, connection setup and retry risk. Its delay remains within
250 to 900 ms. The 1.5-second soft boundary and five-second public wait still apply.

Page limits use actual advertised limits and the link-time budget for eligible
timeline pages. IDs, account reads and absolute-time routes preserve their own
quotas. Profile and outbox author buckets halve under saturation. The engine
prefetches up to two older pages when it has observed the required preceding
cursor, there is no pending first publication acknowledgement, the link has spare
capacity and the view and device allow background work.

## Public retention

The default in-memory caps are 16,000 regular events, 4,000 replaceable events
and 64 MiB of managed resident allocation. After a verification slice crosses a cap, a
deterministic GreedyDual Size Frequency batch targets 95% of the exceeded cap.
The score combines author affinity, access age, estimated refetch time and
charged resident size, separately from wire refetch cost. The inflation clock advances with the last selected victim.
Projection records access for readable rows. Account lists, one signed witness per active deletion target, read contexts
and held rows take priority over the score. NIP-01 ordering
resolves multiple revisions of an addressable event.

The last 4,096 evicted IDs retain a timestamp fence. Matching views can ask
for the evicted ID at the inclusive missing second. The fence downgrades covered history until
the event has returned or verified deletion resolves it. A successful relay
refetch increments the ghost counter. Disk restoration can close the fence.

## Scheduler hints

`Hint.focusedSub` identifies the focused visible subscription.
`Hint.sinceScrollMs`, `Hint.sinceInputMs` and `Hint.scrollRowsPerS` carry
optional interaction measurements used by the scheduler.

## Native replay

The ignored `optimizer::replay_test::modeled_native_replay` test uses 30 fixed
seeds and synthetic event arrivals. It calls the actual deterministic policy
and in-memory store with modeled loopback and 24 Mbps link observations. It
does not measure browser startup, live transport, shaping, or publication.
