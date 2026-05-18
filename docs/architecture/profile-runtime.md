# Profile Runtime

## Purpose

Profile runtime owns metadata and authored-note loading for one pubkey.

## Contract

- Profile tabs receive a pubkey from workspace actions.
- Runtime reads cached metadata and notes first.
- Runtime subscribes for kind `0` metadata and kind `1` notes by author.
- Relay reads use enabled read relays from the selected default relay set.
- Closing the tab closes subscriptions.
