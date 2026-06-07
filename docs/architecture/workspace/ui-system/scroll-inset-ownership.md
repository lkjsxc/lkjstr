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

- Feed tabs: `.event-list__scroller` applies `padding-inline-end`.
- Form tabs: tab root applies `margin-inline-end`.
- `.pane-body` never applies horizontal inset on the scroll axis.

### Content inset

- Feed rows: `.feed-scroll-item` applies both inline paddings.
- Form tabs: direct children of `.form-tab` roots apply
  `padding-inline-end`.
- `.event-main` must not add a second inline-end inset.
- Feed tab roots (`.timeline-tab`, `.profile-tab`, `.followees-tab`,
  `.user-timeline-tab`, `.feed-tab`) must not add horizontal padding.

## Feed vs Form

| Pattern | Tab root                        | Track edge                   | Content inset       |
| ------- | ------------------------------- | ---------------------------- | ------------------- |
| Feed    | `.feed-tab`, `overflow: hidden` | `.event-list__scroller`      | `.feed-scroll-item` |
| Form    | `.form-tab`, `overflow: auto`   | tab root `margin-inline-end` | tab root children   |

```text
Feed tab
  .feed-tab (no horizontal padding)
    .event-list__scroller (track edge)
      .event-list__viewport [data-scroll-owner]
        .feed-scroll-item (content inset)
          row content

Form tab
  .form-tab (track edge margin + start padding)
    direct child (content inset end)
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
