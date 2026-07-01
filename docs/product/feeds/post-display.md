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
