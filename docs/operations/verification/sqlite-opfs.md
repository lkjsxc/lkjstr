# SQLite OPFS Verification

## Purpose

Sqlite worker focused gate commands.

## Details

```sh
cargo test -p lkjstr-storage
wasm-pack test --headless --chrome crates/lkjstr-web -- storage
wasm-pack test --headless --firefox crates/lkjstr-web -- storage
pnpm test -- tests/unit/cache tests/unit/events/repository.test.ts
pnpm test -- tests/unit/feed-surface/scan-model-repository.test.ts
```

SQLite verification proves worker ownership, temporary-memory fallback,
repository result shapes, retention deletion, inventory summaries, and Stats
projection. It does not open a full browser workspace flow.
