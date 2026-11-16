# Further device storage work

## Purpose

Design notes only. No clear-cache or settings archive operation is implemented
by the finite [storage inspection](storage-inspection.md) candidate.

## Event-cache clear boundary

A future operation must define which records it can delete from the shared
durable `events` store. That store also holds encrypted DM kinds 4/1059 and
private-list ciphertext. Preserving only private archive KV would not preserve
offline encrypted message history. An indiscriminate `events.clear()` is unsafe.

A disk-cache operation must distinguish durable removal from memory eviction,
preserve reader windows/anchors and protect private/authored dependencies.
Success may report removed records at commit; it cannot promise reclaimed
physical bytes or a permanently empty cache while live events arrive.

A Host-only generation is insufficient across captured writes and other
Workers. Advance a persisted generation atomically with eligible deletions in
an `events`/`kv` transaction. Fence old eligible writes and boot completions;
protected encrypted/authored writes need a preserve/requeue path. A generation
mismatch must not discard a mixed journal's protected records. Exact deletion
eligibility and cooperation with older Workers still need implementation proof.

Keep `engine-accounts`, `dm-seen-v1`, private archive/generation keys, relay
quality, drafts/outbox and the offline shell intact. Active publication jobs
own their complete signed events in memory; the durable publication-route
ledger holds only IDs/routes. Clearing must preserve required authored/retry
records or refuse while that dependency exists.

Required proof: two actual Worker/database connections; old mixed event batches
held across clear; transaction abort; new live traffic; stale boot callbacks;
unchanged encrypted-message/account/private/draft sentinels; exact removed
record count at commit. No broad database or CacheStorage deletion applies.
A reachable control still requires Claude's written specification.

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
