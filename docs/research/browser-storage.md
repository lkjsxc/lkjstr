# Browser Storage Research

## Purpose

Browser storage research captures storage assumptions, risks, and evidence
needs.

## Storage Assumptions

IndexedDB is the practical browser store for event cache, relay evidence, workspace layout, drafts, and account metadata. Local storage is acceptable only for tiny non-sensitive preferences that do not need query behavior.

## Risks

- IndexedDB can be unavailable, blocked, quota-limited, or cleared by browser policy.
- Large event caches can slow startup if read without limits.
- Drafts and key material have different sensitivity and must not share casual export flows.
- Cache migrations can strand users if not treated as product work.

## Mitigations

- Read bounded data for initial workspace restoration.
- Keep cache writes idempotent.
- Render the Home workspace before storage reads finish.
- Fall back to session memory when storage APIs throw or time out.
- Separate sensitive stores from public event stores.
- Show cache failure as a degraded state.
- Provide user-controlled cache clearing and configuration export.

## Evidence Needed

- Practical event cache size limits across target browsers.
- Worker throughput for signature verification batches.
- IndexedDB query patterns needed by timeline panes.
- Quota behavior during long-running relay subscriptions.
