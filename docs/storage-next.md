# Further device storage work

## Purpose

Design notes only. No clear-cache or settings archive operation is implemented
by the finite [storage inspection](storage-inspection.md) candidate.

## Event-cache clear boundary

A future operation should name only the durable public event cache. It must
preserve current reader windows/anchors and private/authored state. A successful
clear can report removed rows at commit; it cannot promise reclaimed physical
disk bytes or a permanently empty cache while new live events arrive.

A Host-only generation is insufficient: an old captured write or another
Worker can repopulate the store after the clear. Add an event-cache generation
in IndexedDB and validate it in every event-write transaction. Clear `events`
and advance that generation atomically in a transaction over `events` and
`kv`. Old writes must fail the generation comparison and discard only their
obsolete cache journal. Boot reads and their completions need the same fence.

Keep `engine-accounts`, `dm-seen-v1`, private encrypted archive/generation keys,
relay quality, public drafts/outbox and the offline shell intact. The current
publication-route ledger does not contain signed event bodies; clear must
retain required active publication records or refuse while that dependency
exists. Do not orphan delivery/retry routes by clearing their required data.

Required proof: two actual Worker/database connections; an old event batch
held across clear; transaction abort; new live traffic; a stale boot callback;
unchanged account/private/draft sentinel values; exact removed-row count at
commit. No broad database deletion or CacheStorage deletion is appropriate.
This requires a written interface specification before adding a control.

## Small settings archive

The current frontend schema contains 19 flat reader/device settings. It
already bounds values and records only overrides, but ordinary `kv.set` falls
back to memory on persistence failure. An import must use an acknowledged
storage commit and preserve old settings if it fails.

An initial archive should include only a strict schema-numbered allowlist of
those explicit settings, at most 16 KiB. Exclude saved accounts, keys, remote
credentials, account relay lists, layout snapshots, arbitrary per-tab state,
composer/outbox contents and private archives. Unknown fields should reject,
not silently carry secret-bearing data. Native validation can accept an
explicit settings snapshot and return a canonical accepted snapshot; the
frontend still owns its normal preference application and durable storage.

Do not export all `lkjstr:` localStorage or IndexedDB `kv`. Those containers
also hold drafts, reading positions and secrets. Account `relays.save` signs
and publishes a relay list; a settings import must never invoke it implicitly.
Visitor relay preferences are a separate device concern, outside this first
settings-only archive. Workspace backup and encrypted cross-device setup
need separate contracts and Claude's surface specification.
