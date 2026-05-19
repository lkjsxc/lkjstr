# Feed Memory

## Purpose

Feed memory rules keep local cache reads, relay backfill, and UI rendering
bounded as timelines grow.

## Contract

- Feed pages request `30` items by default.
- Home, Global, Profile, and Notifications keep at most `180` loaded feed
  items per tab.
- Thread tabs keep at most `240` loaded thread items.
- Older pages are requested with `until` set from the oldest loaded event.
- Live relay subscriptions set `since` when the runtime starts so old relay
  history is not replayed into the live window.
- Historical relay reads are one-shot `REQ` pages with bounded `limit`; they
  close on EOSE, terminal relay state, or timeout.
- Home author chunks share one total page budget. A large follow list must not
  multiply the request limit by chunk count.
- Metadata lookup is scoped to authors currently present in loaded items and is
  capped to `30` missing profiles per loaded page.
- Oversized relay messages above `64 KiB` are rejected before verification,
  storage, or rendering, and are surfaced through relay diagnostics.
- When the sliding window prunes newer items, the tab exposes a compact jump to
  latest action.

## Cache Bounds

- IndexedDB is the durable event cache.
- In-memory event maps are a bounded fallback for tests and non-browser
  execution, not the primary browser cache.
- Event indexes support kind/time, author/kind/time, and `e` or `p` tag lookup.
- Local event compaction prunes by age and count.
- Default compaction limits are `30` days and `5000` events.
- Accounts, settings, relay sets, workspace state, notifications, and Tweet
  drafts are protected from event cache pruning.

## Verification

- The heavy-feed browser smoke test loads thousands of synthetic events and a
  large follow list.
- The app JavaScript heap must stay below `100 MB`.
- Total Chromium process RSS is reported separately because browser baseline
  memory is outside app control.
