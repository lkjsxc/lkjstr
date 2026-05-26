# Feed Surface Staged Pipeline

## Purpose

Older-page latency is reduced by rendering row shells before profile and
reference enrichment finishes.

## Stages

1. **Relay page** — acquire events; persist through the repository.
2. **Row shell** — merge into the feed window; render from event bodies
   immediately via `feedRowShells` in `src/lib/feed-surface/row-shell.ts`.
3. **Enrichment** — hydrate profiles and reference previews for visible and
   near-visible rows asynchronously.

Stage 3 must not block stage 2. Runtimes call `onItems` with shells first, then
schedule profile and reference loaders.

## Rollout

| Surface | Staged pipeline |
| ------- | ---------------- |
| Home, Global | Required |
| Profile notes, Thread | Required after Home/Global |
| Notifications | Shells for target events; native list |
| Search, Custom Request | Cache-first page; enrichment async |

## Verification

- Unit: `tests/unit/feed-surface/row-shell.test.ts`
- Playwright: older-page rows appear before profile names on synthetic relay
