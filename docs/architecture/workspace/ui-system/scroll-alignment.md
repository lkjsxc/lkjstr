# Scroll Alignment

## Purpose

Scroll alignment defines how feed and form tabs keep the scrollbar track in the
same horizontal position when the user switches tab kinds inside one split pane.

## Tokens

```css
--scroll-track-edge: var(--space-2);
--scroll-content-inset: var(--space-3);
```

## Feed Tabs

Feed tabs use `.feed-tab` with `overflow: hidden` and zero horizontal padding on
the tab root.

| Layer         | Owner                                                                            |
| ------------- | -------------------------------------------------------------------------------- |
| Track edge    | `.event-list__scroller` via `padding-inline-end`                                 |
| Content inset | `.feed-scroll-item` via both inline paddings                                     |
| Scroll owner  | `.event-list__viewport` or documented notification root with `data-scroll-owner` |

Feed tab roots must not add a second horizontal inset. `.event-main` must not
duplicate the content inset.

## Form Tabs

Form tabs use `FormTabShell` with the same two-layer pattern as feed lists.

| Layer         | Owner                                          |
| ------------- | ---------------------------------------------- |
| Track edge    | `.form-tab__scroller` via `padding-inline-end` |
| Content inset | scroll children via both inline paddings       |
| Scroll owner  | `.form-tab__scroll` with `data-scroll-owner`   |

All tool tabs route through `FormTabShell.svelte` so New Tab, Settings, Tweet,
and the other form surfaces share the feed track-edge mechanism.

## Tab Kind Switch Rule

When the user switches between a feed tab and a form tab in the same pane, the
active scroll owner's `getBoundingClientRect().right` must differ from the pane
body right edge by `--scroll-track-edge` within one device pixel.

Misalignment usually means:

- a feed tab root still pads content horizontally,
- a form tab is missing `.form-tab__scroll`,
- a hybrid tab uses a toolbar outside the feed scroll owner without the hybrid
  shell contract.

## Hybrid Tabs

Custom Request and Author Context use `.hybrid-tab`. See
[hybrid-tab-shells.md](hybrid-tab-shells.md).

## Verification

- CSS contract: `tests/unit/workspace/scroll-layout-css.test.ts`
- Host boundary: tab-kind scroll alignment test in feed scroll regression suite
- Audit checklist: [../scroll-surface-audit.md](../scroll-surface-audit.md)

## Related

- [scroll-inset-ownership.md](scroll-inset-ownership.md).
- [feed-shell.md](feed-shell.md).
- [../scroll-layout.md](../scroll-layout.md).
- [../../data/feed-surface/scroll-regression-tests.md](../../data/feed-surface/scroll-regression-tests.md).
