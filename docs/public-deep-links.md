# Public deep links

## Purpose

Path templates for opening public Nostr entities in the workspace.

| Path | NIP-19 entities | Tab |
| --- | --- | --- |
| `/<bech32>` or `/nostr:<bech32>` | Any of the entities below | Thread or Profile |
| `/n/<bech32>` | `note`, `nevent` for any public, non-ephemeral kind | Thread |
| `/p/<bech32>` | `npub`, `nprofile` | Profile |
| `/a/<bech32>` | `naddr` for any public replaceable or addressable kind | Thread |

These paths work signed out. The Worker checks the encoding and route before
the app adds one tab to the current workspace. It then replaces the URL with `/`.
Address reads use the exact author, kind and identifier and show
the newest matching event. Normal replaceable kinds use an empty identifier.
Private kinds 4, 13, 14 and 1059, ephemeral kinds 20000 to 29999, and invalid
kinds stay outside this public path. A valid link with no retrievable event
uses the existing tab availability state. Reloading `/` restores the opened
tab through the workspace store.

Paste a bare reference, `nostr:` URI, or an HTTP(S) link such as lkjstr,
njump, Nostter or Primal into New tab and press Enter or choose the matching
card. The Worker validates the same references before replacing New tab.

Public kinds not assigned a dedicated display face use N2's bounded generic face, with typed tag details.
Copy Link uses the engine-encoded naddr for normal/parameterized replaceable kinds (including empty `d`),
and nevent with kind and author otherwise. Copy ID preserves its previous note representation.
Copy lkjstr link in the note menu copies `https://lkjstr.lkjsxc.com/<nevent>`
for the exact public event, with its author, kind and up to three observed
relay hints when available.
Unknown, malformed, private and ephemeral pointers retain rejection and availability behavior.
