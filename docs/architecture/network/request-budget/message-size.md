# Request Message Size

## Purpose

The request-budget layer estimates outbound Nostr `REQ` message size before a
relay send.

## Contract

- Estimation uses the actual serialized message shape when practical:
  `["REQ", subId, ...filters]`.
- Byte length is measured with `TextEncoder`.
- The app hard cap applies even when NIP-11 omits `max_message_length`.
- A relay `max_message_length` applies per relay when advertised.
- Oversized requests are rejected locally with diagnostics.
- The app does not split oversized `REQ` messages unless a future documented
  split strategy exists.

## Diagnostics

Oversized request diagnostics include:

- relay URL
- estimated byte length
- active cap
- source of cap: app or NIP-11
- surface and purpose label

Raw event payloads, private keys, tab ids, and pane ids are not included.
