# Operation Results

## Purpose

Operation results keep storage failure visible without breaking the browser
workspace. UI callers may continue with fallbacks, but the storage layer must
report what really happened.

## Outcomes

Storage operations use these outcome labels:

- `ok`: storage completed successfully.
- `unavailable`: the storage API or object store cannot be used.
- `timeout`: the caller received a fallback at the deadline.
- `quota-exceeded`: the browser rejected a write because quota was exhausted.
- `blocked`: another connection, permission state, or browser block prevented work.
- `corrupt`: data could not be decoded or normalized safely.
- `aborted-by-owner`: the owning runtime cancelled work intentionally.
- `late-settled`: work returned after a timeout and eventually succeeded.
- `late-rejected`: work returned after a timeout and eventually failed.

## Result Shape

Read operations return either an `ok` value or a failure with fallback, reason,
duration, and operation id. Write operations return either `ok` or failure with
reason, duration, and operation id.

## Problem Taxonomy

Rust storage exposes stable problem-kind labels for diagnostics and host bridges:

- `unavailable-browser-capability`: required storage capability is absent.
- `opfs-open-failed`: OPFS could not be opened.
- `sqlite-worker-init-failed`: the worker or SQLite module did not initialize.
- `temporary-memory-fallback-active`: storage is usable but not durable.
- `schema-repair-performed`: repair changed recoverable storage state.
- `schema-repair-failed`: repair could not produce a safe state.
- `protected-record-decode-failed`: protected row decoding failed.
- `cache-record-decode-failed`: cache row decoding failed.
- `quota-or-write-failed`: a write or quota-bound operation failed.

Outcome labels such as `timeout`, `blocked`, `busy`, `corrupt`, `canceled`,
`late-settled`, and `late-rejected` remain valid problem labels when they name
the exact failure more directly.

## Tracking Rule

Deadline fallback is not settlement. An IndexedDB promise that continues after
timeout remains an active tracked operation until it resolves or rejects.

Runtime memory counters and Stats must reflect actual settlement. Repeated late
settlements or late rejections should be visible as storage diagnostics.

## Caller Rule

Protected user writes must not be described as durable unless the write result
is `ok`. Cache and diagnostic writes may be best-effort at the UX boundary, but
they still report aggregate failure reasons to storage diagnostics.
