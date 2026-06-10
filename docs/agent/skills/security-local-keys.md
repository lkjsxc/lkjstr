# Skill: Security Local Keys

## Purpose

Change signing accounts, local secret storage, NIP-07 integration, secret
export and import, redaction, or browser security capability states without
weakening secret handling.

## Trigger

The change touches `src/lib/accounts/`, secret rows in storage, signer
resolution, passkey or WebAuthn or Web Crypto paths, or diagnostics that
could carry secrets.

## Read First

- [../../security/local-keys.md](../../security/local-keys.md).
- [../../architecture/data/local-secret-security.md](../../architecture/data/local-secret-security.md).
- [../../architecture/data/storage/kernel/local-secrets.md](../../architecture/data/storage/kernel/local-secrets.md).
- [../../execution/operating-rules.md](../../execution/operating-rules.md)
  for the unsupported-state and secret defaults.

## Files Likely Touched

- `src/lib/accounts/local-secret-store.ts` and `src/lib/accounts/signer.ts`.
- `src/lib/tabs/accounts/` for account UI flows.
- `src/lib/storage/repositories/secrets-store.ts`.
- `crates/lkjstr-storage/src/local_secrets.rs`.
- `docs/security/local-keys.md` when the contract changes.

## Procedure

1. Update the security contract before source.
2. Keep secret rows in protected storage tables, separate from public account
   rows, and excluded from cache cleanup.
3. Keep every reveal, copy, export, and import behind an explicit user
   action.
4. Show explicit unsupported states when passkey, WebAuthn, Web Crypto, or
   NIP-07 capabilities are missing; never degrade silently.
5. Prove redaction: secrets never reach logs, diagnostics, relay messages,
   upload requests, or normal export paths.

## Focused Gate

```sh
pnpm test -- tests/unit/accounts
pnpm test -- tests/unit/storage
cargo test -p lkjstr-storage local_secret
```

Use the SEC-001 and SEC-002 rows in
[../../operations/focused-gates.md](../../operations/focused-gates.md) when
host-boundary or diagnostics behavior changed.

## Final Gate

Run the Docker final gate before handing off changes to secret storage,
signing flow, or export behavior; otherwise record it as not run.

## Must Not

- Do not log, export, migrate, or expose secrets except by explicit user
  action and documented product behavior.
- Do not fake signing success for local signers or NIP-07; a rejection is a
  denied state, not an error to retry silently.
- Do not imply browser-local encryption protects against a compromised app
  runtime.
- Do not move secret rows out of protected tables or weaken their cleanup
  exclusion.
- Do not add a passkey path that does not really encrypt with Web Crypto and
  WebAuthn PRF where supported.

## Handoff

State explicitly that no new path logs or exports secrets, and name the
redaction tests that prove it.
