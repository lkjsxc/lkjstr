# Home Feed Source

## Purpose

Home requests kind `1`, `6`, and `16` notes from followed pubkeys plus the
active account pubkey when a follow list exists.

## Authors

When follow list is **loaded**:

```txt
authors = unique(activePubkey, ...followPTags)
```

When follow list is **loading**:

- No notes relay scan with self-only authors
- Status: `loading-follows`

When follow list is **absent** after the follow-list kind `3`
read/subscription completes (EOSE/read result) across the intended relay
set:

- Status: `no-follow-list`
- Empty visible feed with guidance
- **No** automatic `authors = [activePubkey]` relay scan
- Unrelated subscription EOSE markers must not be used to finalize missing
  follows.

## Filters

- Built only through `buildTimelineFilters({ kind: 'home', ... })`
- Chunked when author count exceeds relay limits
- Kinds: `1`, `6`, `16` only

## Route reads

- Bootstrap and route-discovery may use selected-relay fallback groups
- Older and newer **page** reads use NIP-65 author route groups plus selected
  base relays only (`routeGroupsForPaging`)
- Warm initial, older, and newer reads prove coverage per route group, relay,
  filter key, and interval before network reads. Complete proof skips relay I/O;
  partial proof queries only uncovered route requirements.

## Rust explicit older-read slice

The Rust Home island provides an explicit older command.
It retains the selected account, loaded follow set, selected read relays, and a
bounded owner-local event window. The command is unavailable without a real
provider, a loaded follow set, or a compound timestamp/event-id cursor.

The initial bounded read asks for the latest 30 matching events up to now,
not just events from the last 30 seconds. Its live-query model remains separate.
Older requests keep the cursor second inclusive on the wire and reject events
outside the requested authors, kinds, time range, or compound boundary locally.
They preserve event-id deduplication and relay provenance. The visible window
stays bounded while moving toward older rows; repeated commands must not create
concurrent reads. Releasing or replacing the owner cancels its requests and
rejects late results. Empty, failed, or capped replies are not evidence of global
history exhaustion and must leave an explicit diagnostic rather than fake
success. No automatic older loop is introduced in this slice.

This does not complete route-group/cache-coverage parity or remove the retained
TypeScript implementation. NIP-65 routing, older cache coverage, automatic scroll
paging, and broader Home deletion proof remain separate work.

## Status

| Rule                                           | Status      |
| ---------------------------------------------- | ----------- |
| No self-only fallback on missing kind 3        | implemented |
| Missing cached kind 3 triggers relay discovery | implemented |
| Include active account when follows exist      | implemented |
| Independent from profile route selection       | implemented |

## Related

- [../../product/feeds/home.md](../../../product/feeds/home.md)
- [../runtime/merge-reducer.md](../runtime/merge-reducer.md)
