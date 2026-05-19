# Relay Management

## Purpose

Relay Settings owns editable relay sets and the selected default set. Relay
Logs owns session-only relay diagnostics.

## Contract

- First boot seeds one editable public default set only when no set exists.
- Users can add, remove, enable, and disable relay records.
- Users can toggle read and write capability per relay.
- The selected default set drives timeline, profile, thread, and Tweet runtime.
- Restore defaults replaces the public default set by explicit user action.
- Runtime relay state and last error are shown beside each Relay Settings
  record.
- Relay Logs opens from New Tab and shows one flat chronological stream for the
  current browser session.
- Relay Logs diagnostic rows include severity or kind, message, relay URL,
  optional subscription id, and timestamp.
- Relay Logs is read-only. Add, remove, and enablement controls remain in Relay
  Settings.
- Relay Logs are not persisted; reloading the app clears current-session
  diagnostics.
- Relay URLs are visible in Relay Settings and Relay Logs, not inside post rows.
- Relay messages, context, and URLs wrap without horizontal scrolling.
