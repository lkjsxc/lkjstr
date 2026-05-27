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

## Implementation

Profile runtime and `buildTimelineFilters({ kind: 'profile', ... })`

## Status

implemented
