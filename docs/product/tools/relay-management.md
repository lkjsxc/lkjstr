# Relay Management

## Purpose

Relay Settings owns editable relay purpose lists and the selected user set.
lkjstr Log owns session-only diagnostics.

## Contract

- First boot seeds one editable user default set and one editable discovery
  default set only when no relay set exists.
- Users can add, remove, enable, and disable relay records in each purpose.
- Users can toggle read and write capability per user relay.
- Discovery relay rows expose enabled state, label editing, remove, restore,
  NIP-11 fetch, and diagnostics. They do not expose read or write toggles.
- The selected user set drives timeline, profile, thread, selected-relay tools,
  and Tweet runtime.
- Discovery relays drive only metadata and kind `10002` relay-list discovery.
- Restore defaults replaces one purpose default set by explicit user action.
- Runtime relay state, persisted attempts, successes, failures, last connected
  time, and last error are shown beside each Relay Settings record.
- Relay Settings can fetch NIP-11 information from the relay HTTP endpoint with
  an `application/nostr+json` accept header.
- Relay Settings displays real relay name, description, supported NIPs,
  software, limitations, contact, icon URL, banner URL, terms of service,
  payment URL, stale state, and unavailable states when those fields exist.
- Relay Settings displays NIP-11 policy warnings for auth-required,
  payment-required, restricted-write, proof-of-work, and created-at-bound
  metadata.
- Relay Settings displays effective request limits and clamp reasons when a
  selected relay participates in budgeted reads.
- Relay Settings shows persisted relay diagnostic summaries including attempts,
  opens, errors, last event id, timing, validation counters, and recent bounded
  diagnostic messages.
- Kind `10002` relay list metadata creates per-account NIP-65 suggestions.
  Suggestions are review-only until explicit import, and import must not
  overwrite disabled relay records.
- lkjstr Log opens from New Tab and shows one flat chronological stream for the
  current browser session.
- lkjstr Log diagnostic rows include area, severity, code, message, redacted
  context, and timestamp.
- Relay Settings and lkjstr Log present relay parse diagnostics with byte
  details when available.
- Relay Settings and lkjstr Log expose `send-queue-full` diagnostics without
  automatically disabling or removing the relay.
- lkjstr Log keeps relay settings read-only. Add, remove, and enablement
  controls remain in Relay Settings.
- lkjstr Log is not persisted; reloading the app clears current-session
  diagnostics.
- Persisted relay diagnostics live in Stats and Relay Settings, not as copied
  lkjstr Log rows.
- Relay URLs are visible in Relay Settings and lkjstr Log, not inside post rows.
- Relay messages, context, and URLs wrap without horizontal scrolling.

## Rust Conversion Status

- The Rust/WASM shell renders a partial Relay Settings surface from real relay
  set rows.
- Rust Relay Settings supports default user/discovery seeding, add, remove,
  enable, label edit, read/write toggles for user relays, selected default user
  set, and explicit restore defaults per purpose.
- Rust Relay Settings does not yet write relay route-block rows, fetch NIP-11
  records, import NIP-65 suggestions, or show live relay diagnostics; the
  TypeScript surface remains the parity source for those flows.
