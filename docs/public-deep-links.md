# Public deep links

## Purpose

Path templates for opening public Nostr entities in the workspace.

| Path | NIP-19 entities | Tab |
| --- | --- | --- |
| `/n/<bech32>` | `note`, `nevent` for any public, non-ephemeral kind | Thread |
| `/p/<bech32>` | `npub`, `nprofile` | Profile |
| `/a/<bech32>` | `naddr` for any public replaceable or addressable kind | Thread |

These paths work signed out. The Worker checks the encoding and route before
opening a tab. Address reads use the exact author, kind and identifier and show
the newest matching event. Normal replaceable kinds use an empty identifier.
Private kinds 4, 13, 14 and 1059, ephemeral kinds 20000 to 29999, and invalid
kinds stay outside this public path. A valid link with no retrievable event
uses the existing tab availability state. Reloading `/` restores the opened
tab through the workspace store.

Until the generic face lands, another kind uses the note body and its kind
context without an action row or reply field. The dedicated any-kind browser
scene and `/n/` address alias remain with N2/N7 in [interface-view.md](interface-view.md).
