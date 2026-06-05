# NIP Support

## Purpose

This file records implemented, design-only, not implemented, and out-of-scope
Nostr protocol surfaces without claiming unavailable behavior.

## Core Support

- NIP-01 event shape, first-party IDs, signatures, filters, and relay
  messages.
- NIP-11 relay information documents, typed limitation parsing, local request
  bounds, policy diagnostics, and stale or failed metadata states.
- NIP-07 browser extension signing.
- NIP-19 `npub`, `nsec`, `note`, `nprofile`, `nevent`, and `naddr` entities.

## Product Support

- NIP-02 follow lists for home timelines.
- NIP-05 identifiers for profile display.
- NIP-10 reply and thread tags.
- NIP-18 repost target parsing, generic repost feeds, and embeds.
- NIP-19 public-key, note, event, profile, and address references in content.
- NIP-19 profile and event references render as visibly underlined mention
  tokens in shared post surfaces.
- NIP-25 reaction target parsing, `+`/empty likes, `-` dislikes, Unicode emoji
  reactions, custom emoji reactions, and `k` target-kind tags.
- NIP-28 channel creation, metadata, messages, hide-message actions, and mute
  user actions for Public Chat.
- NIP-30 custom emoji tags, optional kind `30030` emoji-set addresses, custom
  emoji reactions, HTTPS emoji rendering, and incoming shortcodes limited to
  `[A-Za-z0-9_-]`.
- Manual lkjstr-created local shortcode input stays stricter at
  `[A-Za-z0-9_]`; invalid incoming tags render as plain text and invalid image
  loads fall back to shortcode text.
- NIP-51 newest kind `10030` emoji list and referenced newest kind `30030`
  emoji sets for active-account custom emoji choices.
- NIP-36 sensitive content gates.
- NIP-42 relay auth diagnostics only. The app records challenges but does not
  automatically answer relay auth.
- NIP-50 search filters from Search, with cached fallback and relay support
  constrained by relay behavior.
- NIP-57 zap requests, invoice handoff, receipt amount parsing, and event zap
  summaries.
- NIP-65 relay list metadata parsing for kind `10002` `r` tags with explicit
  import controls.
- Blossom/NIP-B7 configured-server media upload with raw blob transport,
  scoped auth event, descriptor parsing, and SHA-256 validation.
- NIP-96 media upload discovery and response parsing for compatibility
  providers.
- NIP-98 HTTP auth events for NIP-96 media upload.
- NIP-11 relay information documents from relay HTTP endpoints with
  `application/nostr+json` accept headers, including local request-budget
  inputs from limitation fields.

## Status

- Implemented: listed core and product support above.
- Design-only: passkey-protected local secret storage.
- Not implemented: encrypted direct messages.
- Out of scope: wallet custody. Zap support opens or copies invoices only.

## Rule

Protocol docs describe behavior only after tests or explicit implementation
tasks exist.
