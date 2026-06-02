# Global Feed Source

## Purpose

Global shows recent display-kind notes from selected read relays without an
author filter.

## Filters

- No `authors` field
- Kinds: `1`, `6`, `16`
- Selected relay groups only (`source: selected`)
- Cache reads join relay provenance and filter to the selected relay set.
  Unselected-only cached events stay hidden.
- Complete selected-relay coverage skips relay I/O; partial coverage reads only
  uncovered selected relays.

## Independence

- Must not inherit Home follow authors
- Must not inherit profile route selection

## Implementation

`global-timeline-pages.ts`, `buildTimelineFilters({ kind: 'global', ... })`

## Status

implemented
