# Public view cache

## Purpose

Replay previously verified, finished public rows through the existing renderer
before the Worker is ready. This is a rendering cache, not an event store or
an authority to sign, unlock, publish or admit events to the engine.

## Privacy boundary

Protocol 13 adds cache.policy with a subscription and an allow boolean.
The Rust projection layer owns this permission. A public event selected by
decrypted private-list policy is not a public projection. Every query for an
account with retained decrypted list policy is conservatively denied.
Messages, private drafts, actions, keys, signing replies and account snapshots
are never captured by this path. A denied permission removes both stored
windows for that query before any subsequent public capture can occur.
Denied rows also stay out of the global author suggestions. Cached account faces
retain public identity and signer kind, without private-list or unread evidence.

Only permitted row snapshots are persisted, with their complete query and
render configuration identity. An update preserves this independent
row format. The event database and encrypted account/archive stores are not
opened by the main-thread cache.

## Bounds and reconciliation

The cache retains at most 32 public windows and 2 MiB of UTF-16 key/value data.
An individual window is at most 192 KiB and 64 rows. Top and current-reading
windows have separate keys. Least recently used windows leave first; no account,
layout, draft or other localStorage key is eligible. A lightweight fingerprint
detects accidental corruption; it is not an event signature or security boundary.
Event verification remains an engine responsibility. A separate 600-picture,
256 KiB cache retains learned dimensions only for URLs in permitted public rows;
private media dimensions remain in bounded session memory.

A replay uses the existing cache state and existing rows. The first retained
note is handed back as a reading anchor, so relay arrivals cannot prepend
the reader's initial screen. Missing bootstrap rows do not briefly erase a
confirmed cached screen. Positive updates replace held values quietly; explicit
navigation still asks for the requested window. Render-setting changes suspend
capture on existing subscriptions until they reopen, avoiding ambiguous old
replies. Private policy revocation never turns old private row models into a
public snapshot. Relay EOSE alone never removes a held public event; an explicit
engine removal still reaches the reader and invalidates an empty saved window.

## Verification

On 2026-11-17, all 27 focused frontend cases and the full frontend check passed.
This includes private-author/account-face exclusion, EOSE retention, explicit
removal, count lineage/generation/durability and complete model hydration.
The 01:31 UTC check completed in 11.729 seconds; real-browser probes remain
pending behind the initial account-safe shipment.
Three native projection-permission/revocation cases passed at 00:29:49 UTC
(load 2.44/3.99/6.65). Real Worker/browser and timing evidence remain pending.
The opening race compares immutable production builds; a local mirror is
reported as such. No performance target is claimed from this cache alone.
The count reconciliation draft uses durable contributor lineage and generation,
never the partial-count flag or an aggregate maximum. Restored newer bases may
correct counts downwards. Equal generations require equal opaque tokens, without
ordering the tokens. Different lineages stay held until explicit navigation.
Each view keeps at most 128 committed count/reaction models for its two windows.
Live verified updates may render before their contributor checkpoint commits;
only the last current committed basis is copied to durable row snapshots.
Unproved counts use the existing unknown/lower-bound presentation. The backend
context draft and these frontend changes still await combined native/Worker verification.
