# Feed Surface Footer Phase

## Purpose

All feed-like tabs share one footer phase reducer and one status component.

## Reducer

`feedPagingPhase` in `src/lib/feed-surface/paging-state.ts`:

| Phase | Condition |
| ----- | --------- |
| `idle` | Not loading older; `hasOlder` may be true |
| `loadingOlder` | `loadingOlder`, `hasOlder`, and exhaustion is not proven |
| `end` | `historyExhaustion === 'proven'` and `rowCount > 0` |
| `error` | Terminal `error` string set |

`hasOlder` means another older request is allowed. It is not a proof that no
older history exists when false. Only `historyExhaustion: 'proven'` may render
the terminal `End of known history.` row.

## Component

`FeedSurfaceStatus` in `src/lib/components/events/FeedSurfaceStatus.svelte`
accepts either boolean props or a `phase` prop from `footerPhaseFromPaging` in
`src/lib/feed-surface/footer-phase.ts`.

| Phase | UI |
| ----- | -- |
| `loadingOlder` | Spinner row `Loading older...` |
| `end` | `End of known history.` |
| `error` | Error text from runtime |
| `idle` | Hidden when rows exist and `hasOlder` |

Virtual lists inject terminal rows through `EventTreeListRows` inside
`FeedScrollSurface`. Notifications render the same status component as an
in-scroll row through their flat Virtua list.

## Surfaces

Home, Global, Profile, Thread, Search, Notifications, Custom Request (when a
read has completed), and Author Context use the same footer semantics.
