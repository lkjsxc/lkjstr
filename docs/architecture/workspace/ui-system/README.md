# UI System

## Purpose

This tree is the LLM-facing catalog for shared workspace UI components,
surfaces, and interaction patterns. Product behavior still lives in
`docs/product/`; feed geometry lives in `docs/architecture/data/feed-surface/`.

## Table of Contents

- [identity-surfaces.md](identity-surfaces.md): `IdentityChip`, `UserEventRow`,
  and feed leading-row headers.
- [overflow-actions.md](overflow-actions.md): three-dot menus for secondary
  actions.
- [feed-shell.md](feed-shell.md): `.feed-tab`, scroll ownership, and scrollbar
  inset.
- [scroll-inset-ownership.md](scroll-inset-ownership.md): track-edge and content
  inset single-owner rules.
- [scroll-ownership.md](scroll-ownership.md): tab kind to scroll root map.
- [profile-header-layout.md](profile-header-layout.md): Profile card block
  order and spacing.
- [reaction-surfaces.md](reaction-surfaces.md): emoji picker vs reaction
  summary chips.
- [new-tab-menu.md](new-tab-menu.md): flat New Tab option grid.
- [media-upload-gate.md](media-upload-gate.md): unconfigured upload helper.
- [emoji-palette.md](emoji-palette.md): shared emoji picker and tile-scoped
  placement.
- [scroll-alignment.md](scroll-alignment.md): feed vs form scrollbar alignment
  and tab-kind switch rule.
- [hybrid-tab-shells.md](hybrid-tab-shells.md): Custom Request and Author
  Context toolbar plus feed layout.
- [polish-backlog.md](polish-backlog.md): executable UX polish acceptance
  criteria.
- [surface-source-map.md](surface-source-map.md): contract to source and test
  gate map.

## Rules

- Shipped product UI is Svelte under `src/lib/components/` and
  `src/lib/tabs/`.
- Rust Leptos shells mirror tool contracts here; feed surfaces remain Svelte
  until cutover.
- Every surface uses one documented scroll owner. Pane bodies never scroll.
- Secondary actions belong in overflow menus unless the action is the primary
  row purpose.

## Related

- [../ui-composition.md](../ui-composition.md): component ownership overview.
- [../scroll-layout.md](../scroll-layout.md): scrollbar tokens.
- [../tile-overlays.md](../tile-overlays.md): tile-scoped popovers.
