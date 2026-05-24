# Relay Management

## Purpose

Relay Settings owns editable relay sets and the selected default set. lkjstr
Log owns session-only diagnostics.

## Contract

- First boot seeds one editable public default set only when no set exists.
- Users can add, remove, enable, and disable relay records.
- Users can toggle read and write capability per relay.
- The selected default set drives timeline, profile, thread, and Tweet runtime.
- Restore defaults replaces the public default set by explicit user action.
- Runtime relay state, persisted attempts, successes, failures, last connected
  time, and last error are shown beside each Relay Settings record.
- Relay Settings can fetch NIP-11 information from the relay HTTP endpoint with
  an `application/nostr+json` accept header.
- Relay Settings displays real relay name, description, supported NIPs,
  software, limitations, contact, icon URL, banner URL, and unavailable states
  when those fields exist.
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
