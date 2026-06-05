# Product Polish Audit Targets

## Purpose

This file turns visible backlog items into source anchors. Each row names where
the product behavior should be changed after the destination doc is updated.

## Feed State Rows

| Backlog item | Source anchors | Closing gate |
| --- | --- | --- |
| Timeline loading indicators | `src/lib/tabs/timeline/`, `src/lib/timeline/`, `src/lib/feed-surface/` | timeline reducer and feed-window tests |
| Profile feed loading indicators | `src/lib/tabs/profile/`, `src/lib/profile/` | profile runtime paging tests |
| Notification feed loading indicators | `src/lib/tabs/notifications/`, `src/lib/notifications/` | notification paging and window tests |
| Thread loading indicators | `src/lib/tabs/thread/`, `src/lib/thread/`, `src/lib/events/` | event repository tests plus quiet unit gate |
| Custom Request and Search relay loading | `src/lib/tabs/custom-request/`, `src/lib/tabs/search/`, `src/lib/search/` | custom request parse and search query tests |
| Tweet publish loading state | `src/lib/tabs/tweet/`, `src/lib/tweet/`, `src/lib/relays/relay-pool*` | relay publish and account signing tests |
| Visible profile prefetch | `src/lib/profile/`, `src/lib/events/`, `src/lib/tabs/timeline/` | memory gate plus profile store tests |
| Visible event reference prefetch | `src/lib/events/`, `src/lib/protocol/`, `src/lib/components/events/` | event repository and protocol event tests |

## Workspace Rows

| Backlog item | Source anchors | Closing gate |
| --- | --- | --- |
| Zero-tile and zero-tab behavior | `src/lib/workspace/`, `src/lib/components/workspace/` | workspace tab-retention tests |
| Resize polish | `src/lib/workspace/`, `src/lib/components/workspace/` | workspace resize focused tests |
| Clean startup relay suppression | `src/lib/workspace/`, `src/lib/relays/orchestration/` | relay orchestration and memory tests |

## Account And Tool Rows

| Backlog item | Source anchors | Closing gate |
| --- | --- | --- |
| Active account state clarity | `src/lib/accounts/`, `src/lib/tabs/accounts/` | account local tests |
| Local key risk messaging | `src/lib/accounts/`, `src/lib/tabs/accounts/`, `src/lib/log/` | account tests and app-log redaction tests |
| Import and export boundary | `src/lib/accounts/`, `src/lib/storage/repositories/` | account store and quiet verify gates |
| Upload settings clarity | `src/lib/media/`, `src/lib/tabs/upload-settings/` | protocol upload tests and quiet verify gate |
| Custom emoji hardening | `src/lib/protocol/`, `src/lib/components/events/` | protocol tests |
| Event reference hardening | `src/lib/events/`, `src/lib/protocol/` | event repository tests |

## Edit Rule

Do not use these rows to create fake UI states. Loading, unavailable, partial,
and empty states must be derived from runtime, relay, coverage, or storage
state that the source path already owns.
