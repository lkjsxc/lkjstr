# Stage 1 orchestration optimizer

## Purpose

Document the deterministic read and retention policies and their Stats contract.

## Public reads

The Worker observes completed one-second ingress buckets and request round trips.
The estimator starts at 3,000,000 B/s and 80 ms. Throughput adapts after four
nonzero busy seconds. The last three busy seconds set the saturation flag when
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
and 64 MiB of event payload. After a verification slice crosses a cap, a
deterministic GreedyDual Size Frequency batch targets 95% of the exceeded cap.
The score combines author affinity, access age, estimated refetch time and
payload size. The inflation clock advances with the last selected victim.
Projection records access for readable rows. Account lists, one signed witness per active deletion target, read contexts
and held rows take priority over the score. NIP-01 ordering
resolves multiple revisions of an addressable event.

The last 4,096 evicted IDs retain a timestamp fence. Matching views can ask
for the evicted ID at the inclusive missing second. The fence downgrades covered history until
the event has returned or verified deletion resolves it. A successful relay
refetch increments the ghost counter. Disk restoration can close the fence.
Keep samples and weight counts cover the last pressure batch.

## Protocol additions

Older hosts may omit these fields. Stats request and transport timestamps use
the engine clock. Row spans and absolute window anchors use event or wall time
in milliseconds. Relay indexes are stable for the first 4,096 observed routes
in a Worker session. Request and publication destinations redact private and
auth-gated origins. Public views are correlated through opaque session IDs.
The stage is 1 and the learned parts are off. A Brier score is null until
there are scored decisions.

- `Hint.sinceScrollMs?` reports elapsed scroll time.
- `Hint.sinceInputMs?` reports elapsed input time.
- `Hint.scrollRowsPerS?` reports scroll rate.
- `EngineStats.nowMs?` reports snapshot time.
- `requests[].memberSubs?` lists opaque public view memberships.
- `requests[].role?` identifies primary, hedge or fallback work.
- `requests[].createdAtMs?` reports logical request creation.
- `requests[].firstEventAtMs?` reports first verified delivery or null.
- `requests[].hedgeDueAtMs?` reports the pending hedge deadline or null.
- `worker.lastSliceVerified?` counts successful signature checks in the last slice.
- `worker.verifyQueueCap?` reports the verification event cap.
- `worker.storeEvictions?` counts session retention losses.
- `worker.ghostHits?` counts verified relay refetches of recently evicted events.
- `worker.payloadBytes?` reports retained event payload bytes.
- `worker.replaceableCap?` reports the replaceable count cap.
- `worker.regularCap?` reports the regular count cap.
- `views[].sourceKind?` exposes the source enum.
- `views[].oldestAtMs?` reports the oldest held row time.
- `views[].newestAtMs?` reports the newest held row time.
- `views[].cacheOldestAtMs?` reports the oldest matching cache time at projection.
- `views[].cacheNewestAtMs?` reports the newest matching cache time at projection.
- `bandwidthHistory[].reqsCoalesced?` counts logical request memberships combined.
- `bandwidthHistory[].hedgesFired?` counts newly selected hedge routes.
- `bandwidthHistory[].duplicateBytes?` counts wire bytes of recognized duplicate frames.
- `bandwidthHistory[].queueBusy?` indicates network verification work remaining after a slice.
- `relays[].relayIndex?` gives the session index.
- `relays[].eoseMs?` reports smoothed EOSE round-trip time or null.
- `relays[].usefulShare?` reports the fraction of received events credited as useful or null.
- `orchestrationEvents[].viewSubId?` identifies a related public view.
- `orchestrationEvents[].count?` carries a coalesced membership count.
- `orchestrationEvents[].delayMs?` carries the scheduled hedge delay.
- `orchestrationEvents[].kind` accepts `trip` and `explore` for a later learner.
- `optimizer.stage?` identifies the current optimizer stage.
- `optimizer.parts?` reports per-part modes and trip state.
- `optimizer.link?` reports throughput, RTT, saturation and the throughput sample count.
- `optimizer.variables?` lists link estimates and representative first-screen planning values.
- `optimizer.weightClasses?` counts public candidates by reuse weight.
- `optimizer.keep?` gives up to eight low and eight high retained candidate scores.
- `optimizer.shadow?` reports the comparison counts and optional accuracy scores.

## Native replay

The ignored `optimizer::replay_test::modeled_native_replay` test uses 30 fixed
seeds and synthetic event arrivals. It calls the actual deterministic policy
and in-memory store with modeled loopback and 24 Mbps link observations. It
does not measure browser startup, live transport, shaping, or publication.
