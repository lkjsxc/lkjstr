# Audit Verification Gaps

## Purpose

This file maps open audit and backlog rows to the smallest useful checks. Use it
before running the broader quiet and Docker gates.

## Rust And WASM Checks

| Slice                                                               | Focused checks                  |
| ------------------------------------------------------------------- | ------------------------------- |
| Protocol, signing, relay URL, upload, and NIP helpers               | `cargo test -p lkjstr-protocol` |
| App reducers, feed inputs, Custom Request, and scan planning        | `cargo test -p lkjstr-app`      |
| Relay scoring, route evidence, leases, and browser adapter reducers | `cargo test -p lkjstr-relays`   |
| Storage manifest, row codecs, retention, and inventory              | `cargo test -p lkjstr-storage`  |
| WASM host boundary and browser adapters                             | `pnpm rust-wasm:quiet`          |

## TypeScript Product Checks

| Slice                                | Focused checks                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Feed scan models                     | `pnpm test -- tests/unit/feed-surface/scan-model-bridge.test.ts tests/unit/feed-surface/scan-model-repository.test.ts`   |
| Relay page scans                     | `pnpm test -- tests/unit/events/relay-page-scan.test.ts tests/unit/events/relay-page-adaptive-window.test.ts`            |
| Timeline states                      | `pnpm test -- tests/unit/timeline/timeline-reducer.test.ts tests/unit/timeline/timeline-follow-loading.test.ts`          |
| Profile states                       | `pnpm test -- tests/unit/profile/profile-runtime-paging.test.ts`                                                         |
| Notifications                        | `pnpm test -- tests/unit/notifications/notification-paging.test.ts tests/unit/notifications/notification-window.test.ts` |
| Workspace retention and empty states | `pnpm test -- tests/unit/workspace/tab-retention.test.ts`                                                                |
| Accounts and log redaction           | `pnpm test -- tests/unit/accounts/local.test.ts tests/unit/log/app-log.test.ts`                                          |
| Upload and protocol rendering        | `pnpm test -- tests/unit/protocol`                                                                                       |
| Runtime counters and Stats           | `pnpm test -- tests/unit/app/runtime-counters.test.ts tests/unit/cache/cache-status.test.ts`                             |

## Final Checks

Run the quiet local gate after focused checks:

```sh
pnpm check:repo
pnpm test:quiet
pnpm rust-wasm:quiet
pnpm verify:quiet
pnpm cloudflare:quiet
```

Docker Compose remains the final verification path in
[../../operations/verification.md](../../operations/verification.md). Do not
claim Docker passed unless the images were built and the verification services
ran from those images.
