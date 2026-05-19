# Diagnostics

## Purpose

Diagnostics define browser-visible operational signals. The browser is the
runtime, so failures must be inspectable without server logs.

## User-Visible Signals

- relay connection state.
- relay latency.
- publish outcome per relay.
- subscription count per relay.
- last event received per relay.
- cache health.
- worker queue health.
- signer availability.
- oversized relay message rejection.
- app heap and runtime feed counters during heavy-feed smoke tests.

## Diagnostic Events

Diagnostic events are local app records, not Nostr events. They may be written
to `operation_log` with bounded retention.

Each record contains:

- timestamp.
- area.
- severity.
- code.
- message.
- context without secrets.

## Severity

- `info`: expected state transition.
- `warn`: degraded behavior that still allows work.
- `error`: failed operation requiring user or app action.

## Privacy Rules

Diagnostics must not record private keys, full draft bodies, signer secrets, or
unredacted external signer payloads. Event ids, relay URLs, public keys, and
typed error codes are acceptable.
