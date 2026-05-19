# Relay Management

## Purpose

Relay Settings owns editable relay sets, selected default set, and relay
status.

## Contract

- First boot seeds one editable public default set only when no set exists.
- Users can add, remove, enable, and disable relay records.
- Users can toggle read and write capability per relay.
- The selected default set drives timeline, profile, thread, and Tweet runtime.
- Restore defaults replaces the public default set by explicit user action.
- Runtime relay state and last error are shown beside each relay record.
- Relay URLs are visible here and in diagnostics, not inside post rows.
- There is no separate Relay Monitor choice in New Tab.
