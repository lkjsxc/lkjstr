# Relay Optimizer Verification

## Purpose

This file lists the checks that prove optimizer documentation, reducers,
storage, bridges, Stats rows, and relay scenarios.

## Documentation Gates

```sh
pnpm check:repo
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
```

If a gate fails because a referenced infrastructure file is missing, record the
failure exactly and do not claim it passed.

## Rust Unit Gates

```sh
cargo test -p lkjstr-relays
cargo test -p lkjstr-app
cargo test -p lkjstr-storage
cargo clippy --workspace --all-targets -- -D warnings
```

## Browser And WASM Gates

```sh
pnpm test:quiet
pnpm rust-wasm:quiet
pnpm test:e2e:quiet -- relay
pnpm test:e2e:quiet -- stats
```

## Required Scenarios

Relay scoring:

- initial score is neutral
- EOSE success raises reliability
- timeout penalizes without erasing history
- event-limit is density, not transport failure
- first event improves first-event speed
- unique yield rewards non-duplicate events
- stale entries decay toward neutral
- ordering preserves fairness retry
- score keys exclude tab and pane ids
- filter shape normalization is deterministic

Scan learning:

- no hint uses sixty-second span
- compatible hint is used
- incompatible route fingerprint is rejected
- sparse complete window doubles next span
- balanced complete window keeps span
- dense window splits near visible edge
- incomplete window does not double
- minimum dense segment becomes unresolved
- hint never proves cache absence
- hint never suppresses an uncovered relay
- trace reports hint and feedback counts

Synthetic relay e2e:

- fast relay paints first
- slow relay inserts later in canonical order
- failed relay does not block
- dense scan shrinks or splits the next compatible scan
- sparse scan grows the next compatible scan
- NIP-65-only route does not suppress selected fallback
- measured route outranks stale NIP-65
- Stats shows optimizer evidence

## Final Gate

Docker Compose remains the final gate: validate Compose config, build `app`,
`verify`, `e2e`, `cloudflare`, and `app-smoke`, then run those verification
services from the built images.
