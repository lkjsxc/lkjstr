# Skill: Feed Runtime

## Purpose

Change feed behavior: shared feed runtime, cache coverage proof, feed
windows, row view models, geometry, anchors, LOD, unavailable states, and
the first Home Leptos slice.

## Trigger

The change touches `crates/lkjstr-app` feed modules, `src/lib/feed-surface/`,
`src/lib/timeline/`, `src/lib/profile/`, `src/lib/thread/`,
`src/lib/notifications/`, or a contract under `docs/architecture/feeds/` or
`docs/architecture/data/feed-surface/`.

## Read First

- [../../architecture/feeds/README.md](../../architecture/feeds/README.md).
- [../../architecture/feeds/runtime/README.md](../../architecture/feeds/runtime/README.md).
- [../../architecture/data/feed-surface/README.md](../../architecture/data/feed-surface/README.md).
- [../../architecture/data/cache-first-feed-pages.md](../../architecture/data/cache-first-feed-pages.md).
- [../../architecture/data/feed-coverage.md](../../architecture/data/feed-coverage.md).
- [../../execution/tasks/shared-feed-view-model.md](../../execution/tasks/shared-feed-view-model.md)
  and
  [../../execution/tasks/home-feed-slice.md](../../execution/tasks/home-feed-slice.md)
  for the active queue.

## Files Likely Touched

- `crates/lkjstr-app/src/feed/` and feed reducers in `crates/lkjstr-app`.
- `crates/lkjstr-ui/` for Leptos feed rows.
- `src/lib/feed-surface/`, `src/lib/timeline/`, and surface runtimes as host
  glue while Svelte remains shipped.
- `tests/unit/feed-surface/`, `tests/unit/timeline/`, and
  `cargo test -p lkjstr-app` feed tests.

## Procedure

1. Update the feed contract before source.
2. Keep feed logic in pure reducers: windows, merges, cursors, anchors,
   geometry, and LOD decisions stay deterministic and tested.
3. Require complete coverage evidence before cache-first display; incomplete,
   failed, compacted, or stale evidence never proves absence.
4. Keep runtime windows bounded; hidden tabs release live demands while
   retaining bounded windows.
5. Preserve anchors: live inserts follow the top-anchor policy, and height
   changes are compensated, not yanked.

## Focused Gate

```sh
cargo test -p lkjstr-app feed
pnpm test -- tests/unit/feed-surface
pnpm test -- tests/unit/timeline/timeline-reducer.test.ts tests/unit/timeline/timeline-follow-loading.test.ts
pnpm rust-wasm:quiet
```

Use the Feed Regression gate in
[../../operations/focused-gates.md](../../operations/focused-gates.md) when
ordering, windows, or anchors changed.

## Final Gate

Run the Docker final gate before any feed surface parity or deletion claim;
otherwise record it as not run.

## Must Not

- Do not render placeholder rows or synthesize events; see
  [../no-fake-data.md](../no-fake-data.md).
- Do not treat missing coverage as proof of absence.
- Do not show empty states before documented absence proof exists, on Profile
  and Home in particular.
- Do not add unbounded feed windows, caches, or observation maps.
- Do not claim broader surface parity from a narrow Home slice.

## Handoff

Name the reducers and surfaces that changed and the shared-feed proof gaps
that remain open in blocker rows 3 and 4.
