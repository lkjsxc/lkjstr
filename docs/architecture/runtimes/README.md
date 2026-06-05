# Runtime Architecture

## Purpose

Runtime docs define how tab-owned loaders combine cache and relay data.

## Table of Contents

- [followees-runtime.md](followees-runtime.md): viewed-profile follow-list rows.
- [global-runtime.md](global-runtime.md): global recent notes.
- [home-runtime.md](home-runtime.md): home follow and note loading.
- [notifications-runtime.md](notifications-runtime.md): notification indexing.
- [profile-runtime.md](profile-runtime.md): profile metadata and notes.
- [public-chat-runtime.md](public-chat-runtime.md): NIP-28 channel chat runtime.
- [query-runtime.md](query-runtime.md): query contracts.
- [thread-runtime.md](thread-runtime.md): thread root and replies.
- [tweet-runtime.md](tweet-runtime.md): draft and publish helpers.
- [user-timeline-runtime.md](user-timeline-runtime.md): public target-user timelines.

## Shared Contract

- Feed runtimes follow [feed-surface.md](../data/feed-surface.md) for near-end
  thresholds, speculative older prefetch, `FeedSurfaceStatus`, and staged row
  materialization.
- Home, Global, and Profile posts use the same cache-first page pipeline: plan
  route groups and bounded filters, prove exact SQLite coverage, render covered
  cached rows before relay I/O, and query only uncovered relay requirements.
  Notifications are the remaining feed runtime that still needs this top-level
  return path.
- Older-page loaders clear `loadingOlder` in success and failure paths.
- Bounded error text is exposed instead of unhandled promise failures.
- Startup promises that are intentionally not awaited log one bounded runtime
  error row when rejected.
- Near-end loading uses `max(1200px, 2 x viewport)` and optional sentinels.
- Public Chat is a feed-like runtime with channel discovery, selected-channel
  messages, explicit coverage, and tab-owned cleanup.
- Followees and User Timeline are action-opened runtimes keyed by target pubkey;
  User Timeline separates viewer account from target subject.
- Hosted Worker code serves the SvelteKit shell only. Tab runtimes do not depend
  on Cloudflare storage, a server-side account service, or a relay proxy.
