# SEC-001 Passkey Capability State

## Purpose

Implement truthful Web Crypto and WebAuthn PRF capability states for local secret protection.

## Status

ready

## Current Evidence

- passkey protection is documented as open and must not be claimed until real

## Next Edit

Add capability detection and unsupported/denied states before any encrypted-secret claim.

## Files To Read

- docs/agent/skills/security-local-keys.md
- docs/security/local-keys.md
- docs/architecture/data/local-secret-security.md

## Files To Touch

- src/lib/accounts/\*\*
- crates/lkjstr-web/\*\*
- crates/lkjstr-ui/\*\*
- tests/unit/accounts/\*\*

## Focused Gate

```sh
pnpm test -- tests/unit/accounts
pnpm test -- tests/unit/log/app-log.test.ts
pnpm verify:quiet
```

## Acceptance

Unsupported browsers show exact unsupported states and no secret leaks occur.

## Must Not

- Do not claim passkey encryption unless encryption actually happens.
