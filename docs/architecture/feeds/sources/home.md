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
