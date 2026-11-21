# Public deep links

## Purpose

Path templates for opening public Nostr entities in the workspace.

| Path | NIP-19 entities | Tab |
| --- | --- | --- |
| `/n/<bech32>` | `note`, `nevent` for kinds 1, 42 and 30023 | Thread |
| `/p/<bech32>` | `npub`, `nprofile` | Profile |
| `/a/<bech32>` | `naddr` for kind 30023 | Thread |

These paths work signed out. The Worker checks the encoding and route before
a tab is opened. For kind 30023, the Worker reads the exact author, kind and
identifier and shows the newest matching event. A valid link with no
retrievable event uses the existing tab availability state. Reloading `/`
restores the opened tab through the workspace store.
