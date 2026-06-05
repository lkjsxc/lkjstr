# NIP-29 Groups

## Purpose

This file defines lkjstr support for NIP-29 relay-based groups.

## Meaning

Requests for `kind-29` in this repository mean NIP-29, not a raw Nostr event
kind `29`. lkjstr must not invent or publish event kind `29` as a group
extension.

NIP-29 groups are identified by the pair of a normalized relay URL and a group
id. A group id is local to that relay. User group events carry an `h` tag with
the group id. Relay-signed group state events are addressable events that carry
the group id in their `d` tag.

## Supported Event Kinds

Implemented protocol constants and parsers cover these NIP-29 kinds:

- `9000`: put user.
- `9001`: remove user.
- `9002`: edit metadata.
- `9005`: delete event.
- `9007`: create group.
- `9008`: delete group.
- `9009`: create invite.
- `9021`: join request.
- `9022`: leave request.
- `9030`: close report.
- `10009`: user group list.
- `39000`: group metadata.
- `39001`: group admins.
- `39002`: group members.
- `39003`: group roles.
- `39004`: LiveKit participants.

## Tags

- `h`: required on group user events. Empty values are invalid.
- `d`: required on group state addressable events. Empty values are invalid.
- `previous`: references recent visible group events for relay-threaded
  context. Unknown values are preserved in raw event storage but only valid
  event references are exposed to UI models.
- Unknown tags remain part of the raw stored event and are not rendered as
  trusted group state unless a parser owns them.

## Trust Boundary

Relay-signed state is scoped to the relay that delivered it. A metadata,
admins, members, roles, or moderation state event from one relay must not be
used as authoritative for the same group id on another relay. If the delivery
relay cannot be matched to the group relay identity, the UI shows the state as
untrusted or unavailable rather than silently accepting it.

Newer state replaces older state only for the same relay plus group id plus
state kind. Older state never overwrites newer state.

## Product Contract

NIP-29 Groups are the forward group-chat surface. Public Chat remains the
implemented NIP-28 compatibility surface until NIP-29 reading and publishing are
real. The UI must never mix NIP-28 channels and NIP-29 groups without labeling
the protocol.

A group timeline requires relay URL plus group id. It reads real relay metadata,
state, and user events by `#h`. Publishing a group message includes the `h` tag
and bounded `previous` tags from visible recent events. Relay errors are
diagnostic and do not create fake group absence.

## Status

Status: partial. Rust protocol constants and pure parsers are the first
implemented slice. Group storage, runtime, and UI remain active targets until
real relay read and publish paths are verified.
