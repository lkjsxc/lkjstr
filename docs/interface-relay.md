# Relay tab

## Purpose

R1: one relay opened on its own, to see what that relay itself serves (owner, 2026-11-26: "I might want something
like a tab for looking at a relay"). The Relays tab says how each connection is doing; this tab looks inside one.

## R1: a Relay tab

- The Relays tab's menu opens one Relay tab per relay of the reader's list, behind it (`relays.openEach`); the owner
  asked for each relay's own stream (2026-11-26 13:15 JST). Each tab is live: new notes from that relay flow in.
- Opens from a row of the Relays tab (Shift splits, middle click opens behind), from a relay address typed into tab
  search (`launcher.relay`), and from a relay reference in a note's tags. Not on the New tab page: it needs a relay.
- The tab is titled by the relay's host. Its tile menu: copy the address, edit the relay list in Settings, Relays.
- The list is an ordinary feed (`feed.ts`): filter bar, day dividers, time rail, the reading place kept. Its first
  row is the relay's head, which scrolls away with the notes as a profile's header does (`relay-head.ts`):
  - the relay's NIP-11 name, or its host, with the connection dot before it; the address in the npub's monospace,
    copied on press;
  - its description as written, wrapped; while the document is awaited `relay.head.asking`, when none came
    `relay.head.missing`, both muted;
  - a muted line: connection state (`relay.*`, with the relay's own error words), round trip, whether it is on the
    reader's list (`relay.head.yours` with Read/Write, or `relay.head.notYours`), the software as the relay names it;
  - limits as chips (`relay.limit.*`: sign-in, paid, writing restricted, proof of work), then operator (a name that
    opens the profile) and contact, then advertised NIPs in `--faint` (`relay.head.nipsHint`: advertised, not proven).
- Notes come from that relay only: the engine gives it a reader of its own (released with the tab, like any route),
  apart from the reader's relays, and lists only the notes it served. A note already held from another relay joins
  once this relay serves it too. Which relay served a note is known for this session; after a reload the list refills
  as the relay answers. Cache and retention are those of other public views.
- Nothing is published and the reader's list is not changed here.

## Engine

`relay` source with `relay: <ws(s) url>`; the address is normalized and anything else is refused. The head row is a
`RelayRow` keyed `relay:<url>` with `info` (`unknown`, `missing`, `ready`) and the bounded NIP-11 fields `name`,
`description`, `software`, `contact`, `admin`, `nips`, `limits`, `pow` and the software's own number field.
