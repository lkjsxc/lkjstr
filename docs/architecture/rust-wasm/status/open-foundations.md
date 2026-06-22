# Open Foundations

## Purpose

Open rust foundations and runtime rule.

## Details

- Product wiring for app query-demand plans, request budgets, page-read dedupe,
  progressive snapshot consumption, diagnostics merge, route-plan discovery
  integration, relay optimizer measurement, and Stats projection.
- Relay adapter product wiring from pure reducers to browser WebSocket and timer
  handles.
- Feed-runtime SQLite wiring, pressure plus byte inventory diagnostics, Search
  provider execution, and NIP-50 merge. Retention delete dispatch, repair worker
  adapters and physical probes, and Search token/tag/query adapters are wired at
  the Rust boundary, but product consumption remains open.
- Product feed runtime wiring for Home, Global, Profile, Notifications, Thread
  and Search now has partial Rust host providers; shipped Home, Global, Profile,
  Notifications, and Thread workspace branches mount Rust islands. Global has
  footer/scroll/viewport-fill older requests and compound older relay cursors.
  Thread bootstrap relay reads and bounded live reply reads plus
  explicit/scroll/viewport-fill older page commands are wired, and
  focused-reference, bounded cached parent-chain, terminal unavailable-parent,
  and continuation-row proof exist. Search provider execution, snapshot
  restore, and cached older pages are wired. Profile
  Follow/Unfollow publishes local or NIP-07 kind `3` events only after relay
  acceptance; Author Context has injected, cache-backed, selected-relay,
  exact-anchor, stored-route, and row-action slices. Custom Request has Rust
  provider-backed planning, relay output, cancellation, request snapshot restore,
  and app-policy/NIP-11 effective-filter proof, while deletion proof and shipped
  TypeScript surface replacement remain open.
- Rust completion evidence remains required before moving top-anchor policy,
  follow-count state, cache-display policy, search indexing, User Timeline
  runtime, or hydration scheduling out of active target status.
- General publish jobs, media upload transport, custom emoji publish support,
  Profile Edit publish, and session log capture wiring for the Rust Log body.
- Full Leptos parity for every product surface and responsive browser QA.

## Runtime Rule

The SvelteKit runtime remains the shipped product until a Rust surface has real
behavior, matching tests, and no fake protocol or placeholder success state.
After a Rust surface reaches parity, delete the matching TypeScript or Svelte
module in the same coherent change and record the evidence in the cutover
ledgers.
