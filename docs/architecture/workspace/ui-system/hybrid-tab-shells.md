# Hybrid Tab Shells

## Purpose

Hybrid tab shells cover tabs that combine a fixed tool header with a feed list
in one pane. They must keep one feed scroll owner and the same scrollbar inset
as pure feed tabs.

## Class

```text
.hybrid-tab.feed-tab
```

Required on:

- Custom Request
- Author Context

## Layout

```text
.hybrid-tab.feed-tab
  .hybrid-tab__toolbar (non-scrolling)
  .event-list (flex child, min-height 0)
    .tab-scroll-track.event-list__scroller (track edge)
      .tab-scroll-owner.event-list__viewport [data-scroll-owner]
        .feed-scroll-item rows
```

Rules:

- The toolbar never scrolls vertically.
- The feed list owns the only `data-scroll-owner`.
- The tab root keeps `overflow: hidden` like other feed tabs.
- Toolbar content uses the same content inset as form-tab children.

## Custom Request

- Toolbar contains the JSON textarea and Run button.
- Results render in `EventTreeList` below the toolbar.
- Error text stays in the toolbar region or as a leading feed row, not in a
  second scroll root.

## Author Context

- Toolbar or status rows stay outside the virtual list when possible.
- Event results use the same `EventTreeList` scroll owner as Search.

## Scroll Alignment

Hybrid tabs participate in the tab kind switch rule from
[scroll-alignment.md](scroll-alignment.md). Because they use `.feed-tab`, their
track edge comes from `.tab-scroll-track.event-list__scroller`, not from
form-tab margin rules.

## Source

- `src/lib/tabs/custom-request/CustomRequestTab.svelte`
- `src/lib/components/workspace/RustIslandHost.svelte`
- `src/lib/components/workspace/author-context-island.ts`
- `src/lib/components/workspace/PaneFeedTabBody.svelte`
- `src/styles/scroll-layout.css`
- `src/styles/hybrid-tab.css`

## Related

- [feed-shell.md](feed-shell.md).
- [../tab-shell-layout.md](../tab-shell-layout.md).
- [scroll-alignment.md](scroll-alignment.md).
