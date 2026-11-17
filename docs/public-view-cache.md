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
engine removal still reaches the reader and removes its row from both saved
windows immediately, even during partial hydration. A removed held anchor moves
to the next retained row without changing the surviving rows' order.

## Verification

On 2026-11-17, all 27 focused frontend cases and the full frontend check passed.
This includes private-author/account-face exclusion, EOSE retention, explicit
removal, count lineage/generation/durability and complete model hydration.
The 01:31 UTC check completed in 11.729 seconds; real-browser probes remain
pending behind the initial account-safe shipment. A later two-row removal
regression failed before correction and passed with all 21 relevant snapshot,
store and count cases at 01:49:18 UTC; type/format checks also passed.
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

## Positive held-reference reconciliation

A replay announces only bounded row keys, event IDs and metadata/quote IDs
through cache.hold. They never become verified events or delivered-row authority.
The engine first looks in its store and IndexedDB; residual exact IDs become
ordinary core wants. Only an original author's verified signed deletion can
produce cache.reconcile. Both saved windows, held rows and remembered faces are
corrected; newer metadata with a different ID survives. A deleted anchor asks
for the surviving held anchor. EOSE, missing bootstrap data and arbitrary cached
authors cannot authorize a deletion.

Counts also carry the committed account/public-mute selection identity. An
older, unknown, cross-account or pending policy cannot replace the held coherent
count model. A newer committed replaceable policy can lower replies without a
contributor change; timestamp comparison is exact and equal-time lower IDs win.
An unfiltered policy never proves removal of a previously known policy. Earlier
unshipped snapshots lacking selection wait for explicit navigation if needed.

The 34 focused snapshot/count/reconciliation/selection cases and full frontend
gate pass after integration on 2026-11-17. Real IndexedDB corruption, old metadata
migration and warm-browser timing proofs are still required.
