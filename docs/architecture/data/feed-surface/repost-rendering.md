# Repost Rendering

## Purpose

Repost rendering uses the shared event display pipeline for the reposted target
so layout, actions, enrichment, and height reservation match normal event rows.
Repost-specific code owns context chrome only.

## Shared Event Renderer Contract

The shared event renderer owns:

- author display and profile fallback.
- content parsing and wrapping.
- custom emoji rendering.
- media rendering and sensitive-content reveal.
- reference and quote previews.
- unavailable reference states.
- action bar policy.
- provenance display.
- row geometry features and height reservation.

It accepts an event display input with context such as timeline, profile,
thread, search, notification, quote, repost target, custom request, author
context, or user timeline. Context may adjust chrome or action policy, but it
must not fork content parsing, emoji, media, references, or geometry.

## Repost Wrapper Contract

A repost wrapper may add compact contextual chrome:

```text
RepostContextChrome
  SharedEventDisplay(target_event, context = repost-target)
```

The Rust row model may render a nested repost target only when the embedded
event parses and passes event-id/signature verification. Invalid JSON, invalid
event shape, id mismatch, bad signature, missing content, or declared target
tag mismatch renders the compact unavailable target state instead of
target-like placeholder content. Kind `6` reposts require a matching declared
`e` target; kind `16` reposts may omit an event tag, but a present `e` target
must not contradict the verified embedded event. Retained Svelte protocol
helpers follow the same rule until the TypeScript surface is removed.

The wrapper may show who reposted, when it was reposted, relay provenance, and
retry or route-expansion affordances when the surrounding surface supports them.
It must not duplicate target event rendering.

## Forbidden Paths

- Rendering a repost target with ad hoc `EventMeta` plus partial content tokens.
- Omitting shared custom emoji, media, references, sensitive-content reveal, or
  action policy for repost targets without a documented reason.
- Giving repost targets a different geometry key family from normal target
  events when the target content and chrome are the same.
- Creating fake target content when the repost target event is missing.

## Geometry

A repost target inherits the shared visual row key and geometry features for the
target event plus a small contextual wrapper feature when chrome is present.
Repost wrapper geometry uses the rendered action summary and nested target, not
raw repost JSON content, so long embedded event JSON cannot create permanent
blank space. The target event measurement participates in the same width, font,
density, content-shape, and schema-generation rules as normal rows. Unloading
the repost wrapper or target display preserves reserved height.

## Unavailable Targets

If the repost target event is unavailable, render a compact real unavailable
state. The state may include attempted relay families and a retry action when
available. It must not invent the target event, author, content, preview, or
success state.

Unavailable target rows still reserve height after measurement and use the same
unload stability rules as other rows.

## Actions And Provenance

- Repost wrapper actions apply to the repost event when the user interacts with
  wrapper chrome.
- Target event actions apply to the target event.
- Relay provenance distinguishes where the repost wrapper and target event were
  observed when both are available.
- Notifications that describe repost activity still render the referenced target
  event through the shared renderer.

## Tests Required

Before repost rendering is marked complete, tests prove:

- normal event and repost target use the same event display planner.
- content wrapping, custom emoji, media, references, and sensitive-content reveal
  match normal event rendering.
- unavailable repost targets are compact and real.
- repost target height reservation uses shared geometry key logic.
- notification repost rows do not use divergent target rendering.

## Related

- [geometry-model.md](geometry-model.md): shared geometry keys.
- [height-reservation.md](height-reservation.md): reserved height contract.
- [unload-height-stability.md](unload-height-stability.md): unload behavior.
- [NIP-18](https://github.com/nostr-protocol/nips/blob/master/18.md):
  repost tag and content rules.
