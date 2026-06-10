# No Fake Data

## Purpose

This file is the canonical product truth rule for lkjstr. Every product
surface renders real data or an explicit real state. Skills, execution docs,
and `AGENTS.md` defer to this file instead of restating the full list.

## Rule

Product code must not present success, content, or protocol results that did
not actually happen.

Forbidden in product paths:

- fake relay responses, relay messages, or NIP-11 relay metadata
- fake NIP-65 relay-list suggestions
- fake profile, notification, or event reference previews
- fake upload URLs or upload success
- fake signing success for local signers or NIP-07
- fake NIP-50 search support claims
- fake wallet, zap receipt, or invoice behavior
- fake passkey, WebAuthn, or Web Crypto success
- placeholder rows, placeholder counters, or placeholder success UI

Allowed real states:

- real data from relays, storage, or the signer
- explicit loading with bounded retry semantics
- explicit unavailable with the real reason
- explicit unsupported when the browser lacks a feature
- explicit denied when the user or signer rejected the action
- real diagnostic states for partial failure

Missing evidence never proves absence. A cache miss is a discovery trigger,
not proof that data does not exist.

## Test Fixtures

Synthetic events, relays, and storage rows are allowed only in tests. They
must be clearly test-only and must not leak into product semantics, default
values, or rendered states.

## Pre-Handoff Audit

When a change touched product behavior, confirm before handoff:

1. Every new UI state is backed by real data or one of the allowed real
   states above.
2. No constant or fixture from `tests/` is imported by product paths under
   `src/` or `crates/`.
3. Unavailable and unsupported states show the real reason instead of generic
   success styling.
4. No doc claims behavior the change did not implement. Use the explicit
   statuses from
   [../repository/documentation-standards.md](../repository/documentation-standards.md):
   implemented, design-only, not implemented, out of scope, or open question.
