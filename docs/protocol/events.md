# Event Semantics

## Purpose

Event semantics define the stored and rendered Nostr event contract.

## Canonical Event Record

Events stored or rendered by the app use a normalized record:

- `id`.
- `pubkey`.
- `created_at`.
- `kind`.
- `tags`.
- `content`.
- `sig`.
- `validation`.
- `seen_on`.
- `first_seen_at`.
- `last_seen_at`.

`seen_on` is relay evidence. It records relay URL, receive time, and whether the event came from an initial query or live subscription.

## Validation States

- `valid`: id and signature verified.
- `invalid_signature`: signature failed.
- `invalid_shape`: event cannot be interpreted as a valid Nostr event.
- `unverified`: accepted temporarily only when verification is queued in a worker.

Unverified events may be staged in cache but must not be rendered as trusted content.

## Duplicate Handling

The event id is the identity. Repeated events merge relay evidence and timestamps. Conflicting payloads for the same id are invalid shape incidents and must be reported to protocol diagnostics.

## Timeline Ordering

Timeline ordering is deterministic:

1. Higher `created_at` first.
2. Lower lexical event id first for ties.

Relay receive time is evidence, not the primary timeline order.

## Tag Interpretation

The kernel exposes helpers for:

- reply root.
- reply parent.
- quoted event.
- repost target.
- reaction target.
- deletion targets.
- `nostr:` event entities in content.
- mentioned pubkeys.
- referenced events.
- address references.
- topics.
- relay hints.
- batch tag-value lookups such as event ids referenced by `e` tags.

Display code consumes parsed tag intent rather than searching tag arrays directly.

Batch tag-value lookup must use IndexedDB compound tag indexes when available
and the memory repository fallback when IndexedDB is unavailable.

## Content Tokens

Post content is tokenized once and rendered consistently across Home, Global,
Profile, Thread, embeds, and Notifications.

- Plain text remains text and preserves line breaks.
- `nostr:npub` decodes to a profile mention and opens Profile.
- `nostr:nprofile` decodes to a profile mention, preserves relay hints for
  entity text, and opens Profile.
- Profile mentions render as readable `@name` labels when profile metadata is
  available and keep the raw token in `title`.
- `nostr:note` decodes to a compact event mention and opens Thread.
- `nostr:nevent` decodes to an event mention, preserves relay hints for entity
  text, and opens Thread.
- Event mentions render as compact buttons instead of raw entity strings.
- Event mention tokens are hidden when the same event is expanded as a
  reference below the content.
- Normal `https://` URLs render as links.
- Media `https://` URLs render as links only when they are not successfully
  embedded.
- NIP-92 `imeta` `url` tokens create media attachments. The optional `m` token
  classifies image, video, or audio.
- Custom emoji render in content, profile names, mention labels, referenced
  author labels, nested repost author labels, and reaction summaries when HTTPS
  emoji metadata is available.

## Embeds

Event embeds are rendered from verified events only. The resolver checks cache
first, batches relay reads by `ids`, stores verified hits, caps missing lookups,
and prevents recursive loops. Missing, deleted, quote, repost, reply, reaction,
and deletion states have explicit display rows.

Action events use target precedence. Reposts, reactions, and deletions expose
only their action target references for preview lookup; reply-root tags on those
events do not create extra visible previews.

Reposts with verified embedded JSON own their target preview through the nested
repost surface. The same target must not also render as a separate referenced
preview.

Quote and reference previews are deduped by event id before rendering. Protocol
reference extraction and the shared event renderer own this dedupe so Home,
Global, Profile, Thread, and Notifications render the same preview set.

Referenced event previews load author profiles when possible and render
identity UI instead of public-key slices.

## Media

Direct `https://` image, video, and audio URLs render inline with bounded
dimensions. NIP-92 `imeta` `url` values use the same renderer and may use the
`m` token to classify media type. Video and audio use controls and never
autoplay. Unknown or non-media `https://` URLs render as normal links. Invalid
URLs and non-HTTPS media are not embedded.
