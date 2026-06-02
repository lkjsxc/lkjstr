# Profile Feed Source

## Purpose

Profile shows notes authored by one pubkey.

## Filters

```txt
authors = [profilePubkey]
kinds = 1, 6, 16 (display kinds)
```

## Independence

- Must not use Home follow list
- Route selection follows profile tab context only
- Cache-first proof uses the profile route fingerprint, target pubkey, selected
  relays, filter key, and bounded interval. Complete proof skips relay I/O;
  partial proof reads only uncovered profile route requirements.

## Implementation

Profile runtime and `buildTimelineFilters({ kind: 'profile', ... })`

## Status

implemented
