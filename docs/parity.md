# Client parity

## Purpose

Expectations shared by Damus, Amethyst, Primal, Coracle, noStrudel and Snort
users, audited against this tree on 2026-11-14. This is a capability inventory,
not an assertion that every named client implements every row. Done means usable;
partial lists the concrete limitation. Local browser checks use fake relays.

## Accounts and identity

| Expected capability | NIP | lkjstr | Evidence or gap |
| --- | --- | --- | --- |
| Create key and explicit backup | 01, 19 | partial | One-step creation and explicit nsec backup; reminder missing. |
| Encrypted key storage and export | 49 | missing | Local keys currently stored unencrypted. |
| Browser extension signer | 07 | done | Signer responses verified against requested event. |
| Remote signer and connection QR | 46 | missing | No bunker or nostrconnect UI. |
| Read-only public account | 19 | done | npub import refuses signing. |
| Multiple accounts | 01 | partial | Fast global switch; no per-tile voice. |
| Follow and unfollow | 02 | partial | Requires a loaded kind 3; no initial empty-list creation. |
| Edit own profile and upload picture/banner | 01, 96 | missing | Profile is read-only. |
| Verified identity display | 05 | missing | No DNS verification adapter. |
| Public/private mute entries | 51, 44 | missing | No mute list UI. |
| Follow sets, lists and user status | 51, 38 | missing | No list/status tiles. |

## Relays and conversations

| Expected capability | NIP | lkjstr | Evidence or gap |
| --- | --- | --- | --- |
| Read outbox relay lists | 65 | done | Planner uses authors' write relays. |
| Edit read/write and DM relay lists | 65, 17 | missing | Diagnostics only. |
| Relay information | 11 | missing | No information fetch/display. |
| Relay authentication | 42 | partial | Local signer only; extension prompts not supported. |
| Relay timeline tile | 01 | missing | Global uses planned relays, no single-relay tile. |
| Notifications | 01, 25, 57 | partial | Individual rows; no grouped filters/read state. |
| Gift-wrapped direct messages | 17, 44, 59 | missing | No conversation list or send/receive UI. |
| Read older direct messages | 04 | missing | No older thread UI. |
| Zap receipts and totals | 57 | partial | Receipt parsing/count display; no zapper list. |
| Zap payment with WebLN or invoice QR | 57 | missing | Sending action explains unsupported state. |

## Reading and writing

| Expected capability | NIP | lkjstr | Evidence or gap |
| --- | --- | --- | --- |
| Cache and relay search | 50 | partial | Notes and people; no filter/hashtag controls. |
| Hashtag timelines and follows | 01, 51 | missing | Hashtags are not dedicated timelines. |
| Replies and thread tiles | 10 | done | Root/reply markers, parent lookup and missing states. |
| Reposts and quotes | 18 | partial | Repost sending/reading; quote reading only. |
| Unicode and custom reactions | 25, 30 | partial | Chips and custom rendering; no picker or set browser. |
| Long-form articles | 23 | missing | No article renderer. |
| Media upload and metadata | 92, 94, 96 | missing | Read reserved image dimensions; no upload UI. |
| Content warnings | 36 | done | Covered content and composer warning. |
| Bookmarks and pins | 51 | missing | No saved-event list UI. |
| Reports | 56 | missing | No reporting UI. |
| Raw event inspector | 01 | missing | No inspector tile. |
| Public links and URI navigation | 19, 21, 27 | partial | Palette parses note/profile pointers; clean paths; article/hashtag routes absent. |
| Delete own events | 09 | partial | Store honors deletions; no own-note deletion action. |
| Undo social actions | 09 | missing | Tab/layout Undo only. |
| Device trust rings | 02 | missing | No graph ordering/media covering. |
| Read markers and away summary | local | missing | Saved anchor restore remains unverified. |

## Workspace and device

| Expected capability | NIP | lkjstr | Evidence or gap |
| --- | --- | --- | --- |
| Independent duplicate tabs | local | done | Native and browser tests; independent draft keys. |
| Tiling and workspaces | local | partial | Nine desks; remount/grace and cross-desk Undo open. |
| Tab feel and responsive tiles | local | partial | Core behavior present; gesture/menu gaps documented. |
| Command palette | local | partial | Views/workspaces; incomplete settings and shortcut hints. |
| Explained settings, import/export | local | partial | Appearance/connection controls; no file import/export. |
| Clear cache with size estimate | local | missing | No clear-cache action. |
| Installable offline shell | local | partial | Manifest/icons exist; no service worker or offline shell. |
| Encrypted optional setup sync | 78, 44 | missing | Same-origin layout channel only. |
| Complete Japanese interface | local | partial | Native literal/table guard and Japanese captures; dynamic external errors remain original. |
