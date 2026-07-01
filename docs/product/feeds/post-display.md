# Post Display

## Purpose

This contract keeps real Nostr posts readable across Home, Notifications,
Profile, Thread, Search, Author Context, Followees, User Timeline, Global, and
Custom Request surfaces.

## Contract

- Every displayed post row is backed by a real event from cache or a relay.
- Feed-like surfaces have one vertical scroll owner. Long content creates real
  row fragments inside that flow, never nested vertical scrollers.
- Row ids are deterministic by event id, notification id, fragment id, or
  explicit state id so cache rows, relay rows, and hydration updates merge
  without duplicate visible posts.
- Repost targets, notification source events, profile notes, thread events,
  search results, and custom request rows use the shared event renderer for
  content parsing, media hiding, custom emoji, references, sensitive warnings,
  actions, and geometry.
- Missing target events, media, profiles, or references render explicit
  unavailable rows with real identities or relay hints when known. They are not
  placeholder content.
- Partial relay failure, relay `AUTH`, `CLOSED`, socket failure, parse failure,
  and storage failure remain diagnostic. They do not prove absence while other
  cache or relay evidence may still arrive.
- Empty copy appears only after the surface has proof for the intended account,
  target, relay set, filter, and bounded time window.

## Read-Availability Interaction

Post display consumes an effective read plan, not raw relay arrays. A
session-default public read plan may render real rows and diagnostics in
read-only mode. Write and signing actions stay disabled until durable signer
and write-relay state exist.

## Screenshot-Class Degraded Storage

When protected account storage, relay settings storage, or cache storage is
unavailable, surfaces preserve real route facts already held by the page or tab.
Warnings stay visible, but they do not replace real cache rows or relay rows.

| Surface        | Minimum real fact                                 | Required degraded behavior                                                                              |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Home           | page active pubkey plus follow proof or discovery | Keep follow-list storage failures diagnostic and continue bounded real kind `3` discovery.              |
| Notifications  | page active pubkey                                | Use allowed session default public read relays for `#p` reads and render real notification/source rows. |
| Profile        | profile pubkey                                    | Request metadata, follow-list, and note evidence; header failure does not block note rows.              |
| Thread         | event id or event pointer                         | Request root, parent, and reply evidence; missing parents render unavailable rows.                      |
| Search         | submitted query                                   | Render local-index rows or real NIP-50 relay rows with capability diagnostics.                          |
| Global         | effective public read plan                        | Render real public notes while per-relay failures stay diagnostics.                                     |
| Followees      | target pubkey                                     | Discover real kind `3` evidence before rendering follow rows or empty copy.                             |
| User Timeline  | target pubkey                                     | Render target-authored posts; follow expansion requires real kind `3` evidence.                         |
| Author Context | anchor event or author                            | Render cached or relay context rows and keep missing-anchor diagnostics.                                |
| Custom Request | explicit filters                                  | Run real filters against explicit or effective relays and render relay rows.                            |
| Public Chat    | channel or channel list                           | Render real NIP-28 events and precise channel or moderation diagnostics.                                |

Empty copy requires route-specific cache or relay coverage proof for the exact
account, target, relay set, filters, and bounded time window. Cache misses,
storage failures, missing profile headers, relay timeouts, socket errors, and
partial relay failures are diagnostics, not absence proof.
