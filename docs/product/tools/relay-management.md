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
- Runtime relay state and last error are shown beside each Relay Settings
  record.
- lkjstr Log opens from New Tab and shows one flat chronological stream for the
  current browser session.
- lkjstr Log diagnostic rows include area, severity, code, message, redacted
  context, and timestamp.
- lkjstr Log is read-only. Add, remove, and enablement controls remain in Relay
  Settings.
- lkjstr Log is not persisted; reloading the app clears current-session
  diagnostics.
- Relay URLs are visible in Relay Settings and lkjstr Log, not inside post rows.
- Relay messages, context, and URLs wrap without horizontal scrolling.
