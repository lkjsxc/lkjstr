# NIP Support

## Purpose

This file records supported and planned Nostr protocol surfaces without claiming
unimplemented behavior.

## Core Support

- NIP-01 event shape, IDs, signatures, filters, and relay messages.
- NIP-07 browser extension signing.
- NIP-19 public-key, note, event, profile, and address entities.

## Product Support

- NIP-02 follow lists for home timelines.
- NIP-05 identifiers for profile display.
- NIP-10 reply and thread tags.
- NIP-18 repost target parsing, generic repost feeds, and embeds.
- NIP-19 public-key, note, event, profile, and address references in content.
- NIP-25 reaction target parsing, `+`/empty likes, `-` dislikes, Unicode emoji
  reactions, custom emoji reactions, and `k` target-kind tags.
- NIP-30 custom emoji tags, optional kind `30030` emoji-set addresses, custom
  emoji reactions, HTTPS emoji rendering, and strict project shortcodes limited
  to `[A-Za-z0-9_]`.
- lkjstr keeps that stricter shortcode rule even when upstream NIP-30 accepts
  additional characters; invalid incoming custom emoji shortcodes render as
  plain text and are never emitted by lkjstr.
- NIP-51 kind `10030` emoji lists and kind `30030` emoji sets for active-account
  custom emoji choices.
- NIP-36 sensitive content gates.
- NIP-42 relay auth diagnostics.
- NIP-57 zap requests, invoice handoff, receipt amount parsing, and event zap
  summaries.
- NIP-96 media upload discovery and response parsing.
- NIP-98 HTTP auth events for media upload.

## Planned Product Support

- NIP-11 relay information documents.
- NIP-50 relay search when supported.
- NIP-65 relay list metadata.

## Later Support

- Encrypted direct messages wait for security docs and signer isolation.
- Wallet custody is out of scope; zap support opens or copies invoices only.

## Rule

Protocol docs describe behavior only after tests or explicit implementation
tasks exist.
