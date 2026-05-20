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

- Older-page loaders clear `loadingOlder` in success and failure paths.
- Bounded error text is exposed instead of unhandled promise failures.
- Near-end loading depends on scroll offset, viewport size, and total scroll
  size.
