# Feed Invariants

## Purpose

Cross-surface rules that every feed runtime must obey. Violations cause user-visible
regressions (wrong order, missing posts, self-only Home).

## Table of Contents

- [event-ordering.md](event-ordering.md): canonical newest-first comparator
- [paging-cursors.md](paging-cursors.md): since, until, overlap, display vs scan
- [filter-safety.md](filter-safety.md): NIP-01 wire filters only

## Rules

- One comparator for all visible event lists.
- Merge by event id; never replace live state with cache wholesale.
- Wire filters exclude app-only keys (`depth`, `source`, `cursor`, etc.).
- Home, Global, Profile, and Notifications use distinct filter builders.
