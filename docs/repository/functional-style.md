# Functional Style

## Purpose

This contract keeps source modules simple to reason about while still allowing
browser APIs, sockets, timers, workers, and storage to be managed directly.
The rules below are enforced by repository checks and must hold for all
first-party product code. Current TypeScript checks run through
`pnpm check:repo`; Rust-aware checks belong in `lkjstr-xtask`.

## No Classes Policy

- **First-party `class` declarations are not allowed in `src/`.**
- `pnpm check:repo` enforces this with a TypeScript AST scan. Svelte files are
  scanned only inside instance and module `<script>` blocks.
- The **sole exception** is `src/lib/storage/browser-db.ts`, where `LkjstrDb`
  may extend `Dexie` because that external API requires subclass table fields.
- Tests may use classes for local fakes such as synthetic WebSockets.
- Source modules must not keep compatibility aliases or `@deprecated` exports.

## Pure Domain Rules

- Business logic lives in **pure functions**: same inputs always produce same
  outputs, no side effects, no mutation of external state.
- Data transformations (filtering, sorting, normalizing, merging) must be pure.
- State transitions that are shared or non-trivial move into **pure reducers**
  that accept `(state, action) -> newState`.
- Helper functions that only compute values must not close over mutable
  external state.
- Prefer immutable updates: return new objects and arrays instead of mutating
  existing ones.

## Effect Factory Rules

- Every effectful runtime object is created by a **factory function**.
- Factory names must start with `create...` (for example `createRelayClient`,
  `createFeedRuntime`).
- Factories return a **plain handle object**, not a class instance.
- The handle exposes the minimum surface needed by callers: read-only state
  accessors, action functions, and a cleanup method.
- Closure-local mutable state is allowed **only** inside factories that own an
  external effect or a bounded in-memory index.
- In-memory collections must declare their bound, eviction rule, or owner in
  a comment near the declaration.

## Cleanup Requirements

- Every factory that creates an effectful resource must return a handle with an
  explicit `close`, `destroy`, or `dispose` method.
- Cleanup must be **idempotent**: calling `close` twice must not throw.
- Parent owners must call child cleanup when the parent is destroyed. Tab
  runtimes close their subscription managers; subscription managers close their
  relay subscriptions.
- Hidden retainers to watch for: maps keyed by request IDs, timer waiters, event
  arrays, relay snapshots, diagnostics, and tab retention records. Any long-lived
  collection needs deterministic cleanup or a documented size and time bound.
- Remove every `AbortSignal` listener in a `finally` block. Use a shared helper
  if the pattern repeats.
- Clear timers and remove DOM event listeners when the owning component or
  factory is destroyed.

## Discriminated Unions

- Use **discriminated unions** for state machines, message types, and tab kinds.
- Every variant must have a literal `kind` or `type` field.
- Example:
  ```ts
  type Tab = { kind: 'home'; feed: FeedHandle } | { kind: 'profile'; pubkey: string; feed: FeedHandle } | { kind: 'tweet'; draft: DraftHandle };
  ```
- Switch on the discriminant; the TypeScript compiler narrows the type
  automatically. Avoid `if ('feed' in tab)` style checks.
- Return early or use exhaustive `switch` statements so the compiler catches
  missing variants.

## Module Boundaries

- `src/lib/` contains domain logic, utilities, and protocol code. It must not
  import from `src/routes/` or Svelte component files.
- `src/routes/` contains SvelteKit routes and page components. It may import
  from `src/lib/`.
- `src/lib/components/` contains reusable Svelte components. It may import from
  `src/lib/` but not from `src/routes/`.
- Cross-imports between sibling modules in `src/lib/` are allowed when the
  dependency direction is clear.

## Rust Rules

- Pure domain functions live in protocol or domain crates.
- Browser effects live behind traits or explicit host adapter functions.
- Production paths return `Result` or `Option`; they do not panic.
- `unwrap`, `expect`, `todo`, `unimplemented`, and placeholder functions are
  rejected outside tests.
- Every browser listener, timer, WebSocket, pending read, worker, and storage
  operation has an explicit owner and cleanup path.
- Any `Rc<RefCell<_>>`, `Arc<Mutex<_>>`, static state, or interior mutability
  must be local to a documented effect boundary.
- Source files stay under 200 lines.

## Review Checklist

When changing runtime code, verify:

1. No first-party classes were added.
2. Every new factory returns a handle with explicit cleanup.
3. Every `AbortSignal` listener has a matching removal path.
4. Every timer has a `clearTimeout` or `clearInterval` on teardown.
5. Every map or set used for request tracking has a deletion path.
6. In-memory caches declare a bound or eviction rule.
7. Pure reducers do not mutate external state.
8. Discriminated unions use a literal `kind`/`type` field.
9. Rust production paths avoid panic helpers and hidden global mutation.

## Reference

- [resource-ownership.md](../architecture/data/resource-ownership.md): who
  creates and who closes each resource.
- [heap-retention.md](../architecture/data/heap-retention.md): observed
  symptoms and investigation strategy.
- [bounded-memory.md](../architecture/data/bounded-memory.md): general
  bounded memory rules.
