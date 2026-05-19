# Runtime Architecture

## Purpose

Runtime docs define how tab-owned loaders combine cache and relay data.

## Documents

- [profile-runtime.md](profile-runtime.md): profile metadata and notes.
- [query-runtime.md](query-runtime.md): query contracts.
- [thread-runtime.md](thread-runtime.md): thread root and replies.
- [timeline-runtime.md](timeline-runtime.md): home timeline subscriptions.
- [tweet-runtime.md](tweet-runtime.md): draft and publish helpers.

## Shared Contract

- Older-page loaders clear `loadingOlder` in success and failure paths.
- Bounded error text is exposed instead of unhandled promise failures.
- Near-end loading depends on scroll offset, viewport size, and total scroll
  size.
