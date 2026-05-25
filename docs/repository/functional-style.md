# Functional Style

## Purpose

This contract keeps source modules simple to reason about while still allowing
browser APIs, sockets, timers, workers, and storage to be managed directly.

## Contract

- Source code in `src/` uses factory functions and plain handle objects for
  first-party runtime state.
- First-party `class` declarations are not allowed in `src/`.
- `pnpm check:repo` enforces the class guard with the TypeScript AST. Svelte
  files are scanned only inside instance and module `<script>` blocks.
- The sole exception is `src/lib/storage/browser-db.ts`, where `LkjstrDb` may
  extend `Dexie` because that external API requires subclass table fields.
- Tests may use classes for local fakes such as synthetic WebSockets.
- Handles expose explicit `close`, `destroy`, or unsubscribe functions for
  owned effects.
- Closure-local mutable state is allowed only inside factories that own an
  external effect or a bounded in-memory index.
- Pure reducers and helper functions own state transitions when the same logic
  is shared or grows beyond direct effect wiring.
- Exported APIs use `create...` factory names for effectful handles.
- Source modules must not keep compatibility aliases for removed class names.
- In-memory collections must declare their bound, eviction rule, or owner.

## Review

When changing runtime code, check for hidden retainers: maps keyed by request
ids, timer waiters, event arrays, relay snapshots, diagnostics, and tab
retention records. Any long-lived collection needs deterministic cleanup or a
size and time bound.
