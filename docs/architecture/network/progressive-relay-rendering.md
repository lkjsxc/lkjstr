# Progressive Relay Rendering

## Purpose

Progressive relay rendering lets feed surfaces render cached rows first, then
merge relay evidence as each read produces valid events, relay state, timeout,
or terminal coverage. User Timeline and Search are first-class consumers: both
must render fast local or fast-relay results before slower relay proof finishes.

Status: Rust owns the pure snapshot reducer and event provenance merge. The
TypeScript read manager still emits product snapshots until Rust feed runtimes
consume this reducer directly.

## Protocol Basis

- [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md) defines
  `REQ`, `EVENT`, `EOSE`, `CLOSED`, `NOTICE`, `since`, `until`, and `limit`.
- NIP-01 initial `limit` results are newest first by `created_at`; same-time
  ties use the lowest event id first. lkjstr keeps descending `created_at` with
  deterministic id tie-breaks and local compound cursors.
- `EOSE` means stored events for that subscription have ended on that relay.
  lkjstr treats only every contacted relay reaching non-error EOSE as complete.
- [NIP-50](https://github.com/nostr-protocol/nips/blob/master/50.md) search is
  relay-specific. lkjstr combines local and remote search by time; relay quality
  ranking is not preserved without a separate ranked result model.
- [NIP-65](https://github.com/nostr-protocol/nips/blob/master/65.md) `kind:10002`
  routes guide targeted reads: author write relays for authored events and read
  relays for mentions. Selected read relays remain the fallback.

## Read States

Per-relay states:

- `pending`: no state evidence yet.
- `connected`: relay state arrived but no event or terminal proof.
- `reading`: at least one matching event arrived.
- `eose`: relay proved the stored window complete.
- `timeout`: timeout or local event cap stopped the read.
- `closed`: relay or socket closed the subscription.
- `auth`: relay requested authentication.
- `error`: socket error or incompatible terminal failure.
- `cancelled`: caller closed or aborted the read.

Aggregate states:

- `idle`: read exists but has no cache or relay evidence.
- `cache-ready`: local snapshot is renderable and relay proof is pending.
- `partial`: at least one relay event is renderable and some proof is pending.
- `complete`: every contacted relay reached non-error EOSE.
- `incomplete`: renderable rows exist but a relay window is unresolved.
- `failed`: no renderable rows and terminal relay evidence is failed.
- `cancelled`: the read was aborted and later evidence is ignored.

## Snapshot Contract

Every snapshot carries:

- `readId`, optional `surface`, aggregate `status`, and compact `reason`.
- Deduped events sorted by descending time and event id tie-break.
- Per-relay state, event counts, duration, and compact terminal reason.
- `startedAt`, `updatedAt`, `durationMs`, and `final`.

Snapshots emit after read start, first valid relay events, relay state changes,
terminal finalization, and cancellation. Snapshot listeners are observational:
listener failures must not fail the relay read.

## Merge Rules

- Merge duplicate event ids once.
- Preserve all relay provenance for duplicate receipts.
- Sort timeline-like rows by descending `created_at` with id tie-breaks.
- Apply display bounds, compound `before` or `after` cursors, and page caps
  after dedupe and sorting.
- Never slice a relay batch before dedupe, provenance merge, local bounds, and
  cap enforcement.

## Paging And Coverage

`hasMore` stays true when any unresolved, dense, incomplete, timed-out, closed,
auth-required, errored, or event-capped relay window may still contain matching
rows. Dense windows retry with larger limits and may split; incomplete windows
resume from the nearest safe overlapping cursor.

Empty UI states are terminal-only. A surface may show cached or partial rows
while relays are pending, and should show compact non-blocking status text for
partial or incomplete coverage.

## Relay Read Scoring

Relay reads may be scheduled by relay plus request-context score. The score key
uses relay URL, surface, phase, direction, route group key, filter shape, and
purpose. Runtime owner or tab ids may appear in diagnostics only; they must not
fork wire dedupe or durable score keys.

Scoring is advisory for ordering and diagnostics. It is not a correctness
filter: enabled relays still receive bounded attempts unless disabled by the
user or cancelled by the owning generation.

Fast relays must not wait for slow relay EOSE before first visible rows render.
Pending slow relays keep aggregate state incomplete instead of empty. Late
events merge by canonical ordering without duplicate ids or false complete
coverage.

User Timeline reads may emit rows from a fast relay for a chunked author set
while slow route groups continue. Later rows merge by event order and keep
follow-graph or degraded-mode notice intact.

Search reads emit local indexed matches immediately, then NIP-50 relay matches
as each relay responds. Unsupported or ignored search filters update diagnostics
without removing local results.

## Cancellation

Each feed runtime owns a generation. Snapshot handlers must check the current
generation and ignore stale continuations after tab close, route recreation, or
newer requests. Cancelled reads keep their final cancelled state and ignore
post-cancel events.

## Diagnostics

Diagnostics stay bounded: read id, surface, relay URL, time window, event
counts, duration, final status, and compact reason. Raw relay payloads, full
filter dumps, and unbounded event arrays are not diagnostics.

## Verification

Required coverage:

- Reducer tests for initial, cache-ready, event, duplicate, EOSE, timeout,
  closed, auth, error, dense/incomplete, final, and cancel states.
- Runtime tests for Home, Global, Profile, Thread, Notifications, Search,
  Custom Request, and Author Context where shared relay reads are consumed.
- UI tests for no false empty state while relays are pending, partial status
  with visible rows, timeout retaining rows as incomplete, and provenance
  updates without row duplication.
- Synthetic relay focused test: a fast relay emits an older event, a slow relay
  emits a newer event, and a failed relay terminates; the UI renders the fast row early
  and later merges the slow row above it.
