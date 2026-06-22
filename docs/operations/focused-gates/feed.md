# Feed Focused Gates

## Purpose

This file owns focused gates for feed rows, user-requested feed reliability, and relay-backed reading behavior.

## Gates

## Feed Regression

```sh
pnpm test -- tests/unit/query/timeline-filters.test.ts
pnpm test -- tests/unit/events/event-order.test.ts tests/unit/events/feed-window.test.ts
pnpm test -- tests/unit/timeline/timeline-reducer.test.ts
pnpm test -- tests/unit/notifications/notification-filters.test.ts
pnpm test -- tests/unit/timeline/timeline-follow-loading.test.ts
pnpm test -- tests/unit/events/event-tree-list-anchors.test.ts
cargo test -p lkjstr-app feed_window
```

Acceptance: rows stay newest-first, duplicate events merge by id, footer states
match real coverage, top-locked live inserts stay at scroll offset `0`, and
missing coverage never proves absence.

## User-Requested Reliability

```sh
pnpm test -- tests/unit/workspace/new-tab-options.test.ts tests/unit/workspace/action-tabs.test.ts
pnpm test -- tests/unit/profile/profile-follow-count.test.ts tests/unit/profile/profile-runtime-paging.test.ts
pnpm test -- tests/unit/user-timeline tests/unit/follow-graph
pnpm test -- tests/unit/search/search-query.test.ts
pnpm test -- tests/unit/tweet/tweet-composer-layout.test.ts
cargo test -p lkjstr-protocol nip19
cargo test -p lkjstr-domain new_tab_catalog
cargo test -p lkjstr-app follow_graph cache_display hydration_priority
```

Acceptance: lkjsxc opens a fixed User Timeline, unknown following counts are not
zero, profile empty states wait for proof, User Timeline chunks large author
sets, local Search uses the index, and Tweet Publish layout stays fixed.
