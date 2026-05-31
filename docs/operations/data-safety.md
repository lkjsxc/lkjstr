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
- compacting local cache without deleting accounts, settings, relay sets,
  composer recovery data, active tab state, or workspace state.
- pruning old notification and feed/page cache rows without deleting source
  events or user-owned workspace records.
- enforcing whole-origin cache pressure by deleting only eligible ledger-backed
  cache rows while protected accounts, settings, relay sets, drafts, workspace
  rows, active jobs, active snapshots, and safety/configuration rows remain.
- reporting protected-only, unknown-only, inventory-incomplete, unsupported, or
  quota-unavailable pressure instead of treating unexplained browser usage as
  successful recovery.
- keeping Stats cache recovery actions usable when IndexedDB is blocked,
  corrupt, or missing an expected object store; failed reads fall back to
  already known safe values rather than surfacing uncaught storage exceptions.
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
