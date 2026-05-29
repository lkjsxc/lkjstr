# Memory Prioritization

## Purpose

Memory prioritization separates durable browser-owned data from app-owned
runtime state that can be bounded, summarized, or rebuilt.

## Contract

- IndexedDB data is durable user/browser data. Memory pressure handling must
  not evict accounts, local secrets, settings, relay sets, notifications,
  drafts, workspace state, tab snapshots, or cache metadata.
- Cached Nostr events are durable cache data, but they are prunable under the
  user's configured event-cache byte budget.
- App-owned runtime state is bounded by count, byte size, TTL, owner lifetime,
  or a scored ephemeral retention rule.
- Relay ingress is bounded before expensive parsing: inbound text frames are
  limited to `1048576` bytes, event content to `262144` bytes, tags to `512`,
  fields per tag to `16`, and tag field text to `4096` bytes.
- Local query helpers must plan from IndexedDB indexes where possible and must
  not scan the full event table for memory relief.
- Event cache compaction uses the `eventPriority` score and byte-accounting
  rows. See [retention/README.md](retention/README.md). Steady-state operation
  enforces a byte budget, not a fixed cached event count.
- Notification state is windowed by notification record count. Missing source
  events remain visible as compact unavailable rows.
- Event row tokenization is cached by event content and emoji tags with a
  `1000` entry, five minute TTL. Token output is profile-independent.
- Relay page scans retain bounded, deduplicated candidates and merge relay
  provenance for retained event ids.
- Runtime memory snapshots expose counts only. They must not include raw
  events, relay payloads, subscription ids, tab ids, request ids, or log
  messages.

## Preference Order

When memory must be reduced, prefer in this order:

- Drop closed runtime handles, timers, queued reads, and stale abort listeners.
- Prune bounded app-owned windows, token caches, reference caches, relay
  snapshots, diagnostic suppression maps, and fallback stores.
- Under event-cache budget pressure or browser quota pressure, evict
  lowest-scored cached events through indexed compaction.
- Rebuild derived indexes from durable IndexedDB rows when needed.
- Keep protected user/browser records intact even when cache compaction is
  required.
