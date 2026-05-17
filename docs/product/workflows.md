# Product Workflows

Owner: Product
State: Canon

## Onboard Relays

The user can start without an account, add relays manually, test them, and save a named relay set. The app records read/write intent per relay and shows whether each relay is reachable.

Acceptance:

- Adding a relay validates URL shape before connection.
- Saving a relay set persists it in IndexedDB.
- Failed connections remain visible with reason and last attempt time.
- A read-only user can browse public timelines from selected relays.

## Add Account

The user can add an account by local private key, external signer, or public key only. The account view must clearly show the capability level.

Acceptance:

- Local signing requires explicit confirmation before key persistence.
- External signer accounts can request signatures without importing private keys.
- Public-key accounts cannot publish, delete, or react as that identity.
- Account switching does not destroy open workspace state.

## Read Timeline

The user creates or opens a timeline pane backed by one or more filters and one or more relay sets. Cached events render first, then live events update the pane.

Acceptance:

- Each event shows source relay evidence when expanded.
- Duplicate events from multiple relays collapse into one display item.
- Muted, blocked, or invalid events are hidden or marked according to user settings.
- The pane reports stale, loading, empty, and error states separately.

## Monitor Relays

The user opens a relay monitor pane to inspect health across configured relays.

Acceptance:

- The monitor shows connection state, round-trip latency, subscription count, last event time, publish result, and recent errors.
- The monitor separates network failure from protocol rejection.
- The user can disable a relay without deleting it.
- Disabled relays stop receiving new subscriptions and publish attempts.

## Compose And Publish

The user writes a note, reply, quote, or tagged post in the composer pane and selects target relays before publishing.

Acceptance:

- Drafts autosave locally.
- Mentions, tags, reply roots, and relay targets are visible before publish.
- Publish results are shown per relay.
- A partially successful publish is preserved with retry actions for failed relays.
