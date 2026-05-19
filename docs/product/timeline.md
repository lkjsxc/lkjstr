# Home

## Purpose

Home is the account-follow feed. It shows notes from the selected account and
its NIP-02 follows.

## Contract

- Home opens from New Tab and is the recovery tab.
- Cached notes render before relay results.
- Account home authors are the active account plus `p` tags from the latest
  kind `3` follow list.
- Relay reads use enabled read relays from the selected default relay set.
- Relay reads go through the subscription manager.
- Events and relay provenance are written through the shared repository.
- Deleted or disabled relays are not replaced by hidden public defaults.
- No active account means no relay subscription.
- No follow list means self notes are queried and the state remains visible.
- Loading ends when cached items exist, a relay sends matching events, any relay
  reaches EOSE, or every contacted relay reaches a terminal failure state.
- A failed relay remains diagnostic and must not block other relays.
- Relay `CLOSED`, `NOTICE`, `AUTH`, parse failure, and invalid signatures are
  visible diagnostics.
- Author controls open Profile tabs in the same tile.
- Event id controls open Thread tabs in the same tile.
- Post rows do not show relay source text or full public-key text.

## States

- `no-active-account`: cache only; account action required.
- `loading-follows`: active account exists and follow discovery or notes load.
- `no-follow-list`: latest kind `3` is absent; self notes are queried.
- `no-enabled-relay`: selected set has no enabled read relay.
- `auth-required`: a relay sent `AUTH`.
- `subscription-closed`: a relay sent `CLOSED`.
- `relay-failed`: selected relays are unreachable.
- `ready-empty`: relay EOSE completed with no matching notes.
- `ready-with-events`: cache or relay data has matching notes.
