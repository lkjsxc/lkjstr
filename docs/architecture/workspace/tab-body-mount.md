# Tab Body Mount

## Purpose

Tab body mount defines how pane stacks keep tab UI in the DOM while only the
active tab receives input and live relay work.

## Contract

- Each tab in a pane group renders one `.pane-body` inside `.pane-stack`.
- Bodies overlap in a single grid cell. CSS controls visibility and stacking.
- Active tab body:
  - `data-active-tab="true"`
  - `visibility: visible`
  - `pointer-events: auto`
  - `aria-hidden="false"`
- Inactive tab bodies:
  - `data-active-tab` absent or false
  - `visibility: hidden`
  - `pointer-events: none`
  - `aria-hidden="true"`
- Inactive feed tabs must not hold live relay subscriptions or near-end paging.
  Runtimes pause through `visible` / `active` props on tab bodies.
- Tool tabs may keep cheap local state in the hidden DOM (scroll position, form
  fields) without network work.

## Blur and Focus

- Blur still runs the workspace snapshot coordinator: scroll remember, runtime
  snapshot, IndexedDB `tabStates`, and optional warm LRU.
- Focus shows the hidden body immediately. Live DOM scroll and form state win
  over snapshots when the body stayed mounted.
- Warm snapshot and IndexedDB `load` apply when the body was not mounted (reload,
  first open after recovery, or tab inserted after startup). Delivery is a
  one-shot restore token owned by `workspaceId + tabId`.

## Session Retention

- `tabs.inactiveRetentionSeconds` governs in-memory snapshot TTL and LRU cap
  (`32`). It does not control DOM mount lifetime.
- Session snapshots accelerate restore after reload or when mount state is
  missing. They are not a substitute for mounted DOM during normal tab switches.

## Non-Goals

- Do not keep relay subscriptions active on hidden feed tabs.
- Do not run near-end paging or virtua scroll handlers on hidden feed lists.
- Do not unmount tab bodies on mere focus change. Unmount only on tab close or
  pane destroy.

## Related

- [tab-runtime.md](tab-runtime.md): runtime lifecycle and snapshot fields.
- [tab-retention-flow.md](tab-retention-flow.md): blur/focus snapshot pipeline.
- [tabs.md](../../product/workspace/tabs.md): product-visible tab behavior.
