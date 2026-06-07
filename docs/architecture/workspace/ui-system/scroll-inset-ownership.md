# Scroll Inset Ownership

## Purpose

Scroll inset ownership defines which element applies track-edge and content
inset so scrollbar tracks align across tab kinds inside split panes.

## Tokens

```css
--scroll-track-edge: var(--space-2);
--scroll-content-inset: var(--space-3);
```

## Single-Owner Rules

### Track edge

- Feed tabs: `.tab-scroll-track` on the `.event-list__scroller` wrapper applies
  `padding-inline-end`.
- Form tabs: `.tab-scroll-track` on `.form-tab__scroller` applies the same
  `padding-inline-end`.
- `.pane-body` never applies horizontal inset on the scroll axis.

### Content inset

- Feed rows: `.feed-scroll-item` applies both inline paddings.
- Form tabs: direct children of `.form-tab__scroll` apply both inline
  paddings.
- `.event-main` must not add a second inline-end inset.
- Feed tab roots (`.timeline-tab`, `.profile-tab`, `.followees-tab`,
  `.user-timeline-tab`, `.feed-tab`) must not add horizontal padding.

## Feed vs Form

| Pattern | Tab root                        | Track edge                               | Content inset       |
| ------- | ------------------------------- | ---------------------------------------- | ------------------- |
| Feed    | `.feed-tab`, `overflow: hidden` | `.tab-scroll-track.event-list__scroller` | `.feed-scroll-item` |
| Form    | `.form-tab`, `overflow: hidden` | `.tab-scroll-track.form-tab__scroller`   | scroll children     |

```text
Feed tab
  .feed-tab (no horizontal padding)
    .tab-scroll-track.event-list__scroller (track edge)
      .tab-scroll-owner.event-list__viewport [data-scroll-owner]
        .feed-scroll-item (content inset)
          row content

Form tab
  .form-tab (no horizontal padding)
    .tab-scroll-track.form-tab__scroller (track edge)
      .tab-scroll-owner.form-tab__scroll [data-scroll-owner]
        direct child (content inset both sides)
```

## Split Pane Alignment

Switching between feed and form tabs in the same pane must keep the scrollbar
track inset from the split handle within one device pixel. Misalignment usually
means two layers applied the same inset or a feed tab root still pads content.

## Verification

- Compare `getBoundingClientRect().right` on feed and form scroll owners in the
  same pane.
- Assert feed tab roots have zero horizontal padding in style contract tests.
- See [scroll-surface-audit.md](../scroll-surface-audit.md) and
  [scroll-regression-tests.md](../../data/feed-surface/scroll-regression-tests.md).

## Related

- [feed-shell.md](feed-shell.md).
- [../scroll-layout.md](../scroll-layout.md).
- [scroll-ownership.md](scroll-ownership.md).
