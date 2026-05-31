# Crate Boundaries

## Purpose

This file assigns Rust crate ownership. Status: design-only.

## Crates

- `lkjstr-protocol`: Nostr events, filters, tags, messages, IDs, signatures,
  relay URLs, NIP entity codecs, upload auth, and protocol-safe serialization.
- `lkjstr-domain`: pure reducers and data models for feeds, workspace layout,
  settings, notifications, relay route plans, cache scoring, diagnostics, and
  memory counter labels.
- `lkjstr-relays`: relay request scheduling, subscription aliases, request
  budgets, read dedupe, progressive snapshots, scoring, and relay state
  machines.
- `lkjstr-storage`: executable storage manifest, typed repositories, storage
  outcomes, cache ledger, retention dispatchers, repair, inventory, and pressure
  states.
- `lkjstr-app`: application composition, browser-local services, jobs, startup
  recovery, account selection, tab runtimes, and UI command layer.
- `lkjstr-ui`: Leptos components, CSS-class rendering contracts, workspace
  shell, pane chrome, feed rows, dialogs, tools, and responsive layout.
- `lkjstr-web`: `cdylib` WASM entrypoint and host adapters for browser APIs.
- `lkjstr-xtask`: repository checks, line caps, docs checks, storage manifest
  comparison, quiet command orchestration, and generated-doc checks.

## Dependency Direction

Domain crates do not depend on browser crates.

```text
lkjstr-web -> lkjstr-ui -> lkjstr-app
lkjstr-app -> lkjstr-domain
lkjstr-app -> lkjstr-protocol
lkjstr-app -> lkjstr-relays
lkjstr-app -> lkjstr-storage
lkjstr-relays -> lkjstr-protocol
lkjstr-storage -> lkjstr-domain
lkjstr-storage -> lkjstr-protocol
```

`lkjstr-web` may depend on every app crate because it is the final browser
entrypoint. Lower crates must not call browser APIs directly.

## Source Rules

- Pure domain functions live in `lkjstr-protocol` or `lkjstr-domain`.
- Production paths return `Result` or `Option`; they do not panic.
- Browser effects live behind traits or explicit host adapter functions.
- Any interior mutability is local to a documented effect boundary.
- Source files stay under 200 lines.
