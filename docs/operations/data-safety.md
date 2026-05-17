# Data Safety

Owner: Operations
State: Canon

## Local Data Classes

- Public Nostr data: events, public keys, profiles, relay evidence.
- User configuration: relay sets, workspace layout, display preferences.
- User-authored data: drafts, publish attempts, local notes.
- Sensitive data: private keys and signer authorization material.

## Storage Rules

- Public data can be cached and exported.
- User configuration can be exported and imported.
- Draft export requires explicit user action.
- Sensitive data requires separate consent and clear warning before persistence, export, or deletion.

## Recovery

The app must support:

- clearing relay health without deleting relay configuration.
- deleting cached events without deleting workspace layout.
- deleting an account without deleting public cached events.
- exporting workspace and relay configuration.
- importing configuration into an empty profile.

## Deletion

Deletion actions must name the affected data class. Destructive actions need confirmation and must not be bundled with unrelated cleanup.

## Key Handling

Local private key support is allowed only when the user explicitly imports or creates key material. External signer accounts remain preferred when available. Public-key-only accounts must never prompt for signing as though they can publish.
