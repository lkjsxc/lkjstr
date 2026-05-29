# Relay Read Scoring

## Purpose

Relay read scoring orders bounded relay attempts and explains diagnostics
without changing correctness.

## Score Key

Durable or in-memory scores use:

`relayUrl + surface + phase + direction + routeGroupKey + filterShape + purpose`

Do not use raw tab ids, pane ids, runtime owners, or transient subscription ids
in score keys. Those values are diagnostics only. Identical wire-equivalent
requests must still share page-read and lease dedupe.

## Inputs

Each observation may include:

- `firstEventMs`
- `eoseMs`
- `durationMs`
- `eventCount`
- `finalCount`
- `timeout`
- `closed`
- `auth`
- `socketError`
- `eventLimitReached`
- `updatedAt`

## Outputs

Scores are bounded numeric fields:

- `reliability`: completion without transport or relay failure.
- `speed`: time to first useful event and EOSE.
- `yield`: useful result density for the request shape.
- `penalty`: timeout, auth, close, socket error, or event-limit cost.
- `score`: final scheduling value.
- `sampleCount` and `updatedAt`: bounded history metadata.

## Update Rules

- Initial scores are neutral so new relays receive attempts.
- EOSE without error raises reliability.
- Timeout, socket error, closed, auth, and event-limit outcomes lower
  reliability or add penalty.
- Lower first-event latency raises speed.
- Higher useful event yield raises yield.
- Updates use a bounded weighted average and clamp every field.

## Scheduling Rules

- Normalize relay URLs before scoring.
- Sort candidate relays by score for the current request context.
- Preserve fairness: low-score relays are delayed, not starved.
- User-disabled or removed relays stay excluded.
- Cancellation by the owning generation stops pending work and ignores late
  observations.

## Ownership

`src/lib/relays/relay-read-score.ts` owns pure scoring functions. The first
store is bounded in memory. Durable persistence is optional only if capped by
row count and age.
