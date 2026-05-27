# Runtime Architecture

## Purpose

Runtime docs define how tab-owned loaders combine cache and relay data.

## Documents

- [global-runtime.md](global-runtime.md): global recent notes.
- [home-runtime.md](home-runtime.md): home follow and note loading.
- [notifications-runtime.md](notifications-runtime.md): notification indexing.
- [profile-runtime.md](profile-runtime.md): profile metadata and notes.
- [query-runtime.md](query-runtime.md): query contracts.
- [thread-runtime.md](thread-runtime.md): thread root and replies.
- [tweet-runtime.md](tweet-runtime.md): draft and publish helpers.

## Shared Contract

- Feed runtimes follow [feed-surface.md](../data/feed-surface.md) for near-end
  thresholds, speculative older prefetch, `FeedSurfaceStatus`, and staged row
  materialization.
- Older-page loaders clear `loadingOlder` in success and failure paths.
- Bounded error text is exposed instead of unhandled promise failures.
- Startup promises that are intentionally not awaited log one bounded runtime
  error row when rejected.
- Near-end loading uses `max(1200px, 1.5 x viewport)` and optional sentinels.
- Hosted Worker code serves the SvelteKit shell only. Tab runtimes do not depend
  on Cloudflare storage, a server-side account service, or a relay proxy.
