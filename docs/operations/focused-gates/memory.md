# Memory Focused Gates

## Purpose

This file owns focused gates for bounded runtime memory and background work cleanup.

## Gates

## Memory

```sh
pnpm test -- tests/unit/relays/relay-message-data.test.ts tests/unit/protocol/messages.test.ts
pnpm test -- tests/unit/events/repository.test.ts tests/unit/events/relay-page-scan-hardening.test.ts
pnpm test -- tests/unit/notifications/notification-paging.test.ts tests/unit/notifications/notification-window.test.ts
pnpm test -- tests/unit/memory tests/unit/fp tests/unit/app/runtime-counters.test.ts
pnpm test -- tests/unit/custom-request/parse.test.ts tests/unit/settings/settings-store.test.ts
```

Acceptance: app-owned counters, cleanup paths, wait queues, and bounded maps
return to documented idle states. Browser RSS is diagnostic only.

## Background Work

```sh
pnpm test -- tests/unit/fp/resource-scope.test.ts tests/unit/fp/async.test.ts
pnpm test -- tests/unit/memory tests/unit/cache tests/unit/relays/orchestration
```

Acceptance: every task has an owner, cancellation is idempotent, queue bounds
are enforced, maintenance work yields, and late completions do not retain owners.
