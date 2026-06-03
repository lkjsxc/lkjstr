# Orchestration Verification

## Purpose

Verification proves that orchestration decisions are pure, durable where needed,
bounded, and visible in Stats.

## Rust Gates

```sh
cargo test -p lkjstr-app -- orchestration
cargo test -p lkjstr-storage -- orchestration
cargo clippy --workspace --all-targets -- -D warnings
```

## Browser Gates

```sh
pnpm test:quiet -- orchestration
pnpm test:e2e:quiet -- orchestration
pnpm rust-wasm:quiet
```

## Required Scenarios

- Matching Home tabs attach to one shared query.
- Profile route-group evidence does not contaminate Global.
- Notifications use independent semantic keys.
- Cache-first complete coverage returns SQLite rows before relay reads.
- Partial coverage renders cached rows and starts uncovered relay work.
- Disabled relays are excluded before route, scan, score, and prefetch planning.
- Stats explains route, scan, wait, cache, hydration, and retention decisions.
- Closing owners releases runtime memory and stops hidden feed paging.

## Final Gate

Docker Compose remains the final verification path after focused gates pass.
