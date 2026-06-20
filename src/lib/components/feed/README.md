# Feed Components

## Purpose

Shared feed list UI shells used by timeline and notification tabs.

## Table of Contents

- [FeedScrollSurface.svelte](FeedScrollSurface.svelte)
- [FeedMeasuredRow.svelte](FeedMeasuredRow.svelte)
- [feed-scroll-intent.ts](feed-scroll-intent.ts)

## Files

- `FeedScrollSurface.svelte`: Virtua scroll root, near-end sentinel, `data-scroll-owner`.
- `FeedMeasuredRow.svelte`: row min-height reservation and above-viewport compensation.
- `feed-scroll-intent.ts`: downward user-scroll intent before older paging.

## Related

- `docs/architecture/data/feed-surface/feed-scroll-surface.md`
