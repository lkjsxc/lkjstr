# Data Safety

## Purpose

Data safety defines which browser data classes may be cleared, compacted, or
exported.

## Local Data Classes

- Public Nostr data: events, public keys, profiles, relay evidence.
- User configuration: relay sets, workspace layout, display preferences.
- User-authored data: drafts, publish attempts, local notes.
- Sensitive data: private keys and signer authorization material.

## Storage Rules

- Public data can be cached and exported.
- User configuration can be exported and imported.
- Browser storage is optional for startup. IndexedDB and local storage failures
  fall back to session-only memory.
- Durable writes are best effort when browser storage is blocked, slow, or over
  quota.
- Draft export requires explicit user action.
- Sensitive data requires separate consent and clear warning before persistence,
  export, or deletion.

## Recovery

The app must support:

- clearing relay health without deleting relay configuration.
- deleting cached events without deleting workspace layout.
- compacting cached events without deleting accounts, settings, relay sets,
  notifications, composer recovery data, or workspace state.
- deleting an account without deleting public cached events.
- exporting workspace and relay configuration.
- importing configuration into an empty profile.
- corrupt, invalid, or blocked workspace storage recovering to a usable
  Welcome-focused workspace.

## Deletion

Deletion actions must name the affected data class. Destructive actions need confirmation and must not be bundled with unrelated cleanup.

## Key Handling

Local private key support is allowed only when the user explicitly imports or
creates key material. External signer accounts remain preferred when available.
Public-key-only accounts must never prompt for signing as though they can
publish.
