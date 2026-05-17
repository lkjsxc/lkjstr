# Product Scope

Owner: Product
State: Canon

## Product Definition

Build a browser-first SvelteKit Nostr workspace client for configuring relays, managing accounts, reading timelines, composing events, and monitoring relay behavior.

The product treats relays as user-owned infrastructure choices. The app seeds
an editable default set only when no relay configuration exists.

## In Scope

- SvelteKit single-page product shell with route-level loading only where it improves startup clarity.
- Editable relay sets with labels, read/write flags, and health state.
- Protocol kernel that validates, signs, verifies, filters, and normalizes Nostr events.
- Relay pool that multiplexes subscriptions and publishes across configured relays.
- IndexedDB cache for events, profiles, relay metadata, drafts, account metadata, and workspace layout.
- Web workers for protocol-heavy and cache-heavy tasks.
- Account model for local keys, external signers, and read-only public-key profiles.
- Split-pane workspace UI with saved pane state.
- Timeline pane for home, relay-scoped, author-scoped, tag-scoped, search-like, and custom filter views.
- Relay monitor pane for connection, latency, error, publish, and subscription status.
- Composer pane for text notes, replies, quotes, mentions, tags, and relay targeting.

## Out Of Scope

- Server-side relay proxy as a required runtime.
- Custodial key storage.
- Blockchain, token, wallet, or payment features.
- Admin control of public relays.
- Native mobile shells.
- Algorithmic ranking that cannot be explained from local data and selected relays.

## Product Invariants

- The user can inspect and change the relay set that drives each major workflow.
- No private key leaves the browser unless the user selects an external signer flow that owns that decision.
- Timeline state remains useful during relay churn and offline periods by reading IndexedDB first.
- The app exposes degraded states directly instead of presenting relay failure as empty content.
- Drafts survive navigation, refresh, and temporary relay outages.
