# Interface specification: the client a note was written with

## Purpose

The owner asked on 2026-11-21 (#2780) for a subtle "via <client>" by a note's time, from the NIP-89 `client` tag, on
desktop and phone, with app information for a client that names its handler, and a clear way to leave lkjstr out of
one's own posts. Index and rules: [interface-specs.md](interface-specs.md). The look is in [design.md](design.md).

## W1 Where it stands

- In a note's header line, between the NIP-05 (or the bot badge) and the time: `note.via` ("via {name}"; Japanese puts the name
  first), 12px, `--faint`, tabular nothing. It never adds a line and never moves the time.
- It gives way first: it shrinks with an ellipsis before the NIP-05 and the name do. In a tile under 340px it is not
  drawn (the thread clock rule), so a phone's 390px tile still shows it, cut short if the name is long.
- Every note header carries it: lists, profiles, threads (the focus, compact notes above, replies), notifications
  drawn as notes. Quoted cards and a note still being sent (pending) carry none. No tag: no element at all.

## W2 Text from relays

- The name is relay input. It is drawn as text only. Control and format characters are dropped and whitespace is
  collapsed. At most 48 characters are drawn (then `...`), and CSS cuts it further to fit.
- The full cleaned name, at most 128 characters, is in the tooltip and the accessible name `note.viaLabel`
  ("Written with {name}").

## W3 App information

- With a well-formed handler address (`31990:<64 hex>:<d>`), "via" is a button. Its hit area grows by padding, with
  an equal negative margin, so the header keeps its height. A press, Enter or a tap opens a small popover anchored to
  it, in the menu surface. Escape or an outside press closes it, and focus goes back to the button. Without an address
  it is plain text.
- The engine is asked once per press (`client.info`, below), never on hover or on drawing.
- The popover's states:
  - asking: the tag's name, then `feed.loading`;
  - verified: the handler's own name in bold and its website as a link showing the host. Only `http:` and `https:`
    are allowed. It opens a browser tab with `noopener` only when pressed;
  - not verified (unavailable, malformed or a mismatched author or `d`): the tag's name, then `client.unverified`
    ("No verified app information"). Nothing navigates by itself.

## W4 Leaving lkjstr out of one's posts

Settings, Posting: `set.clientTag` "Posting: Include lkjstr in my posts" (on by default), with the description
`set.clientTag.d`, which names the kinds the engine tags: notes (replies and quotes too), reposts, reactions,
channel creation, edits and messages, and articles. The choice is kept per account. Off: no `client` tag at all.

## Engine needs (additive; [engine-proposals.md](engine-proposals.md) gets one line)

- `NoteRow.clientAddress?: string`: the tag's third value, only when it is a well-formed kind-31990 coordinate.
  `client` stays the tag's name.
- Action `{ a: 'client.info', address }`: the result carries `clientInfo: { name, website? }` when the newest kind
  31990 event by exactly that author with exactly that `d` verifies. `website` is present only for an `http(s)` URL,
  and `name` is bounded. Otherwise `ok: false` with `error.code` `not-found`. The lookup follows the existing
  scheduler and replaceable-event rules. It is cached per address, with no repeat while one is in flight.

## Acceptance

Mock and real fixtures, desktop 1440 and phone 390:

- the via text sits by the time with no new line, and is absent without a tag;
- long or hostile names are cut and stay text, with the accessible name whole;
- a press with an address asks once and shows the verified name and safe host;
- no address, or not verified, shows the tag name and the not-verified line, and nothing navigates;
- keyboard (Tab, Enter, Escape) and touch;
- under 340px it is not drawn.
