# Library

## Purpose

This directory contains reusable application code shared by routes and tabs.

## Table of Contents

- [accounts/](accounts/): account records, signers, and local secrets.
- [app/](app/): app metadata and runtime logging.
- [background/](background/): owner-scoped background task queue.
- [backend/](backend/): browser-local shared query services.
- [cache/](cache/): cache status and retention.
- [components/](components/): shared Svelte components.
- [custom-request/](custom-request/): validated relay request parsing.
- [emoji/](emoji/): custom emoji discovery and parsing.
- [events/](events/): event repositories, parsing, and actions.
- [feed-surface/](feed-surface/): shared feed paging, near-end, row planning, and geometry helpers.
- [follow-graph/](follow-graph/): target NIP-02 discovery and author sets.
- [fp/](fp/): small functional data and resource helpers.
- [identity/](identity/): profile identity helpers.
- [jobs/](jobs/): persisted job records.
- [log/](log/): app log state.
- [memory/](memory/): runtime memory helpers and retention.
- [media/](media/): upload settings and providers.
- [notifications/](notifications/): notification indexing and state.
- [profile/](profile/): profile runtimes and stores.
- [protocol/](protocol/): Nostr protocol kernel.
- [public-chat/](public-chat/): NIP-28 channel chat adapters.
- [query/](query/): timeline query helpers.
- [relays/](relays/): relay clients, pools, and settings.
- [search/](search/): search query parsing.
- [settings/](settings/): flat settings schema and store.
- [storage/](storage/): storage wrappers and OPFS SQLite worker host glue.
- [tabs/](tabs/): tab body implementations.
- [telemetry/](telemetry/): runtime health helpers.
- [thread/](thread/): thread runtime and state.
- [timeline/](timeline/): timeline runtime and state.
- [tweet/](tweet/): Tweet drafts, uploads, and publishing.
- [user-timeline/](user-timeline/): public target timeline runtime helpers.
- [workspace/](workspace/): pane, tab, and layout logic.
