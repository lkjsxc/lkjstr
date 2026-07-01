# Post Display Focused Gate

## Purpose

Focused checks for read availability and real-post display regressions on feed
surfaces.

## Gate

```sh
cargo test -p lkjstr-app read_availability
cargo test -p lkjstr-app home_feed notifications_feed protected_account
pnpm test -- tests/unit/workspace/workspace-page-data.test.ts
```

## Acceptance

Home and Notifications do not render `no-enabled-relay` from relay-settings
storage unavailability when a real page active pubkey and read-only fallback
policy exist. Public and allowed protected read surfaces keep write actions
separate from session default public reads. Post rows remain real event rows or
explicit state rows.
