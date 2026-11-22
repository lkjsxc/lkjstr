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

Public kinds not assigned a dedicated display face use N2's bounded generic face, with typed tag details.
Copy Link uses the engine-encoded naddr for normal/parameterized replaceable kinds (including empty `d`),
and nevent with kind and author otherwise. Copy ID preserves its previous note representation.
Unknown, malformed, private and ephemeral pointers retain rejection and availability behavior.
S4's N2/N7 code is private pending verified real-browser and visual acceptance, not a deployed guarantee.
