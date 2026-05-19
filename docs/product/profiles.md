# Profiles

## Purpose

Profile tabs show identity metadata and authored text notes.

## Contract

- Profile tabs open from identity actions, not New Tab.
- The tab receives a hex pubkey from the workspace command.
- Runtime loads cached metadata and notes before relay data.
- Relay reads use enabled read relays from the selected default relay set.
- Initial and older note pages request `30` items.
- Profile note lists keep a `180` item window.
- Older profile notes load only after scrolling near the bottom.
- Historical note pages use `until` from the oldest loaded note.
- Live relay reads set `since` when the profile runtime starts.
- Closing the tab closes profile subscriptions.
