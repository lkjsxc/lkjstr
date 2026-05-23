# Zaps

## Purpose

Zap docs define the NIP-57 invoice handoff used by event actions.

## Contract

- Zap actions require a NIP-07 active account.
- Event zap tags are preferred over profile Lightning identifiers.
- Profile `lud16` and `lud06` are used when event zap tags are absent.
- Event zap tags may split a zap across multiple weighted recipients. Missing
  weights are equal only when every zap tag omits weight; partially weighted
  tags without weight receive no amount.
- The client signs one kind `9734` zap request per recipient with amount,
  `lnurl`, one `relays` tag containing all receipt relays, recipient `p`, target
  `e`, and target `k` tags.
- The callback request sends `amount`, `nostr`, and `lnurl` query parameters.
- The app validates callback invoice responses before rendering invoice
  controls.
- Zap receipts derive visible amounts from an `amount` tag first, then from
  parseable zap request JSON in the `description` tag.
- Zap receipt summaries group receipts by target event and actor for shared row
  rendering.
- Each invoice renders one QR code whose payload is the raw BOLT11 invoice.
- The app may open a `lightning:` URI or copy the raw invoice, but it does not
  store wallet secrets.
