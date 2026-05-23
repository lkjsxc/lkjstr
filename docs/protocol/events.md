# Event Semantics

## Purpose

Event semantics define the stored and rendered Nostr event contract.

## Canonical Event Record

Events rendered by the app use `NostrEvent`:

- `id`.
- `pubkey`.
- `created_at`.
- `kind`.
- `tags`.
- `content`.
- `sig`.

Stored events add cache metadata:

- `receivedAt`.
- `relayUrls`.

Relay evidence is also stored as one receipt per event and relay URL. The
current cache does not persist event validation state or worker staging state.

## Duplicate Handling

The event id is the identity. Repeated events merge relay URLs and keep the
newest receive time. Conflicting payloads for the same id are ignored by the
repository rather than rendered as separate rows.

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
  entity text and publish tags, and opens Profile.
- Profile mentions render as readable `@name` labels when profile metadata is
  available and keep the raw token in `title`.
- Profile mentions are visibly underlined in every shared post surface.
- `nostr:note` decodes to a compact event mention and opens Thread.
- `nostr:nevent` decodes to an event mention, preserves relay hints for entity
  text, reference resolution, and publish tags, and opens Thread.
- Event mentions render as compact buttons instead of raw entity strings only
  when the same event is not expanded as a reference card below the content.
- Event mentions are visibly underlined in every shared post surface.
- Event mention tokens are hidden when the same event is expanded as a
  reference below the content.
- Normal `https://` URLs render as links.
- Media `https://` URLs render as links only when they are not successfully
  embedded.
- NIP-92 `imeta` `url` tokens create media attachments. The optional `m` token
  classifies image, video, or audio.
- Custom emoji render in content, profile names, mention labels, referenced
  author labels, nested repost author labels, nested repost content, and
  reaction summaries when HTTPS emoji metadata is available.
- Custom emoji images are lazy, async-decoded, no-referrer images. They keep
  normal text emoji height, preserve intrinsic aspect ratio, and cap inline
  width at `6em`. Custom emoji shortcode metadata is case-sensitive and
  HTTPS-only. Unknown or invalid emoji remains visible text, and image load
  failure falls back to shortcode text.

## Embeds

Event embeds are rendered from real events only. The resolver checks cache
first, batches relay reads by `ids`, stores hits, uses a short in-memory TTL
for misses and hits, shares in-flight lookups, caps missing lookups, and
prevents recursive loops. Missing targets render as compact unavailable cards.

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
identity UI instead of public-key slices. Visible protocol labels such as
reply, reaction, and referenced event are screen-reader-only by default.

## Reactions

Kind `7` reaction parsing is structured:

- `+` and empty content are likes and render as hearts.
- `-` is a dislike.
- Unicode content is an emoji reaction.
- `:shortcode:` content is a custom emoji reaction only when a matching valid
  NIP-30 `emoji` tag exists on the reaction event. Incoming shortcode matching
  accepts letters, numbers, underscores, and hyphens.
- Reaction groups include the custom emoji URL and optional address in their
  grouping key, so the same shortcode with different media remains distinct.

## Media

Direct `https://` image, video, and audio URLs render inline with bounded
dimensions. NIP-92 `imeta` `url` values use the same renderer and may use the
`m` token to classify media type. Video and audio use controls and never
autoplay. Unknown or non-media `https://` URLs render as normal links. Invalid
URLs and non-HTTPS media are not embedded.
