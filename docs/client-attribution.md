# Client attribution

## Purpose

Describe the signed NIP-89 tag, account preference and verified app lookup.

## Publishing

New public notes, replies, quotes, reposts, reactions, channel creations,
channel edits, channel messages and articles include exactly one tag by default:

```json
["client","lkjstr","31990:160b7d028b99ef2530be8718d03cb0be6f9449fb74d5ae8d6f09a060c63048b1:lkjstr","wss://relay.ditto.pub/"]
```

The Worker applies the current preference before requesting a signature. It
omits the tag when the account opts out. Publication retries reuse the signed
event, including its original tags. A new signing request uses the current
preference. Profile changes, deletes, lists, relay and HTTP auth, and private
messages do not carry attribution. The browser saves the preference by account
on this device. Existing device-wide choices are the fallback for accounts
without their own setting.

The read path keeps the note's tag name when a handler coordinate is absent or
malformed. A press asks for the exact kind-31990 author and d. The newest
verified event retained for the coordinate wins, with lowest event ID breaking
timestamp ties. Its content must provide an app name; a website is optional
and must be an HTTP(S) URL without credentials. The browser opens a website
only when the reader activates its link.

Cache misses use the ordinary scheduler with configured readers and verified
author outboxes. The pinned lkjstr address can also use Ditto unless it is
configured with reads disabled. Lookups coalesce by coordinate, with at most
eight addresses and eight waiting requests each. They end on completion,
after six seconds, or when the final requesting client detaches. At most
128 unresolved addresses are cached for 30 seconds. Positive answers use
the verified event store and reflect newer retained revisions.

## Public handler readback

At 07:46 UTC on 2026-11-21, Ditto returned two events for the exact author,
kind and d before EOSE. The newest signed event verified as
`9dab8093f992ce59e13345f6a1c606b0f2e7c0c9a4561e4853cc2b0e9b40bcdf`.
Its name is lkjstr and its website is `https://lkjstr.lkjsxc.com`. The check
used one read-only REQ and closed the connection after EOSE.
