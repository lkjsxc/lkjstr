# Interface specification: view anything

## Purpose

Owner #3597 (2026-11-22): almost anything opens and reads well (lists, articles, and recursive things such as a
reaction to a reaction), a reaction can itself be reacted to, and emoji are ready before the picker opens, with two
emoji under one shortcode both usable. This file holds N1 to N7. The emoji parts are E6 and E7 in
[interface-emoji.md](interface-emoji.md). Index and rules: [interface-specs.md](interface-specs.md). Pictures:
`/home/coder/workspace/lkjstr-review/N-20261122-*.png`, with their `.svg` sources beside them.

## Shared rules

- Every event opens. A kind lkjstr knows is drawn with its own face, and any other kind with the generic face (N2).
  Nothing says "unsupported", and no event is dropped because of its kind. Private kinds (4, 13, 14, 1059) and
  ephemeral kinds (20000 to 29999) stay out, as they do today.
- One face per kind, the same wherever it is drawn: a row, the focus of a Thread tab, an embedded card (N3) and a
  list item (N5). The faces are note (1, 42), act (6, 7, 16, 9735), comment (1111, drawn as a note), article (30023),
  list (N5) and generic (everything else).
- Feeds keep their kinds. Home, Global, search and a profile's Posts gain no rows from this batch. Other kinds reach
  the reader through what points at them, deep links, notifications and the profile's new tabs.
- Cards are never nested. An event inside another is drawn in the quoted-note surface (raised, hairline, 8px
  corners). Whatever that event points to is a link line inside the same card, joined by a rail.
- Every face, card and link line opens its event in a Thread tab by the usual rules (Shift splits, middle click behind).
- Naming kinds: the context line above a header (where "reposted by" goes) names every face except note. It uses
  `kind.<n>` when the table has one, otherwise `kind.other` ("Kind {n}"). Names exist for 3, 6, 7, 16, 1111, 9735,
  10000 to 10003, 10015, 10030, 30000, 30002 to 30005, 30015, 30023, 30030 and 39089.
- Reply is offered only where lkjstr writes replies today: notes, channel messages and articles. Elsewhere the reply
  slot stays empty but keeps its width, so the rest of the action row stays on its rhythm.

## N1 One kind table (engine; no surface)

- Replace every kind allow-list in `lkjstr-core` (cache_context, cache_validate, local_read_finish, visibility,
  publication_discovery, deep_links, expiration, client_tag, commands, store query, acts) with one table in one
  module. For each kind it records the face, whether feeds list it, whether it is kept, cached as context, counted
  as a reply or an act, expired, given the client tag, and opened from a link.
- An unlisted kind gets the generic entry: kept, cached as context, openable by id and by address, and listed in no
  feed. Delete the old lists in the same change; leave no fallback path.
- Additive: `NoteRow.eventKind?: number` (absent for 1 and 42), and `eventKind?: number` on `Quote` `ok`. Until N2
  lands, a row of another kind is drawn as a note with the `kind.other` context line.
- Nothing a reader sees changes: feeds, counts and threads stay the same. Native tests show this for each former
  list, and that a kind-30311 event opens by id and by address.

## N2 The generic face, and every kind opens

A generic row or focus, top to bottom:

1. The context line with the kind's name.
2. The header, as a note's: face, name, NIP-05, time and "via".
3. `alt` (NIP-31), when present, at note text size. It is the author's own description, so it goes first.
4. The content. Human text is drawn as note text, with links, mentions, emoji and folding. Data (JSON, or one long
   token) is a monospace block in `--muted`, three lines, folding as a note folds. With no text and no `alt`, the
   body is `generic.empty` in `--faint`.
5. Details: a quiet disclosure `generic.details` with the tag count in faint. It starts folded, unless the event has
   neither `alt` nor text. Unfolded, it shows one line per tag in event order: a word for the tag (`tag.event`
   for e, a and q; `tag.person` p; `tag.topic` t; `tag.link` r and url; `tag.relay` relay; `tag.id` d; `tag.title`
   title and name; `tag.image` image and thumb; `tag.summary` summary and description), or else the tag's own name
   in monospace. Then the value: a person is a name button, an event is a link line (N3), a topic is a `#tag` that
   opens search, and a link opens a browser tab (noopener). Anything else is monospace on one line ending in an
   ellipsis, shown whole on press. After the first 64 tags comes `tag.more`.
6. The action row (shared rules). A repost of any event other than kind 1 is a kind 16 with `k`.

Engine (additive): `NoteRow.face?: Face`, here `{ type: 'generic'; alt?: string; form: 'text' | 'data' | 'empty';
tags: TagLine[]; moreTags: number }`, with `TagLine = { name: string; meaning?: 'event' | 'person' | 'topic' | 'link' |
'relay' | 'id' | 'title' | 'image' | 'summary'; ref?: Ref; text: string }`. `Ref` is an event `{ id, kind? }`, an
address `{ kind, author, d }`, a person, topic, link or relay. The engine decides text versus data; the main thread
parses nothing.

Every kind opens:
- `/n/<note|nevent>` opens an event of any kind, and `/a/<naddr>` the newest event of any replaceable or
  addressable kind ([public-deep-links.md](public-deep-links.md) widens to every kind). Copy link in More gives
  `nevent` with kind and author, or `naddr`.
- The Thread tab's focus is drawn with the event's face. What the event answers stays above it, as in T2: the
  e-tag reply markers of a note, or the root and parent of a NIP-22 comment. Replies, and comments (1111) whose parent
  is the event, are listed under it, as in T3.
- A profile gets three more tabs after Media: `pkind.articles` (30023), `pkind.lists` (the N5 kinds) and `pkind.all`.
  All lists every kind the person published, newest first, each with its face; private and ephemeral kinds stay
  out. These tabs are saved with the profile tab, like the others.

Scenes: `view-generic` (a 30311 with `alt`, folded), `view-generic-data` (JSON, details open), `profile-all`.

## N3 Embedded events and chains

- An event inside another is drawn compact, in the quoted-note surface, by its face. That covers a quote, a `q` tag,
  a `nostr:` reference, an act's target, a comment's parent and a list item that is an event. The header has a 20px
  face, the name, the kind's name in faint and the time. Then:
  - note or comment: today's quote card, with text folded to four lines, and media;
  - act: the act chip after the actor's name, and no body;
  - article: the article card (N6);
  - list: its title, its item count, and the first five people's faces or the first eight emoji;
  - generic: `alt`, else the first line of text, else nothing beyond the header.
- What the embedded event points to is a link line under it, inside the same card. The line holds a 20px face, the
  name, the act chip or the first line of text, and the time, ending in an ellipsis. A 1px `--sep` rail joins the
  faces from link to link, as the thread rail does. The chain follows the first reference until an event points
  nowhere. One card holds at most four events, itself included. A longer chain ends in `embed.deep`, which opens the
  last link drawn.
- A link to an event already drawn in the same row (a cycle or a repeat) becomes `embed.cycle` and goes no further.
- Lazy: the card's own event is requested with the row, as quotes are today. Each later link is requested only once
  the link above it has arrived and the row is within one and a half tile heights of view. Leaving that range
  releases the want.
- A link still being looked for holds one line's height with `embed.loading`, replaced in place. Failures are one
  quiet line (`embed.missing`, `.error`, `.muted`, `.deleted`, `.expired`), never the raw reference.
- A press on the card opens its event, and a press on a link line opens that link's event. Each is its own button
  with a focus ring; Tab visits the card, then its links.
- Engine (additive): `Quote` `ok` gains `face?`, `act?: ActRef`, `label?: string` (the `alt`, title or first line,
  at most 160 characters) and `next?: Quote`; the new states are `cycle` and `deep`. Bounds: four events per
  card, eight cards per row; all wants are released with the row.

Scenes: `embed-chain` (a note quoting a reaction to a repost of a note), `embed-list` (a note quoting a people list),
`embed-cycle`, `embed-loading`.

## N4 Acts are posts

- A reaction, a repost or a zap receipt opened by itself (from a link line, an act chip, a notification or a deep
  link) is the focus of a Thread tab with the act face:
  - the context line with the kind's name and the header with the actor;
  - the body: a reaction's emoji at 32px (a like is the heart icon, and a custom emoji its picture at 32px high), or
    a zap's amount in sats followed by its message as text. A repost has no body;
  - then the target as an embedded card (N3), with its chain.
- The act has its own action row. The reply slot is empty; then reaction, repost, zap, emoji, bookmark and More. The
  counts are those of acts on this act. Reacting sends a kind 7 with `e` (the act), `p` (its author) and `k` (its
  kind: 6, 7, 16 or 9735). A repost is a kind 16 with the same tags. Undo, signing and delivery work as for a note.
- Who reacted: under any focus that has acts, one quiet disclosure line sits under the action row: `acts.show`,
  with the total in faint. Unfolded, it lists the acts newest first, 50 at a time with the feed's paging. Each act
  is one line: face, name, chip (the emoji, the repost icon, or the zap icon with its sats) and time, then on the
  right the heart and the emoji button, with their counts when not zero, and More. That heart reacts to the act. The
  line stays unfolded with the tab.
- Notifications: a press on a reaction, repost or zap notification opens its target's focus with the acts unfolded.
  That notification's acts carry the vermilion bar until seen. An A1 row (an act on the reader's own act) opens the
  reader's act as the focus. An act on an act still counts only for its own target (A1).
- Act chips are buttons: in A1, A2 and the reposted-by line, a press on a chip opens that act. The rest of the line
  keeps its own press.
- Engine: Publish `reaction` and `repost` keep their shape; the engine adds `k`, and uses kind 16 for any target
  that is not kind 1. Additive: `Source` `acts` (the acts on one event, newest first, as `NoteRow` rows with the act
  face), the face `{ type: 'act'; act: ActRef; sats?: number; target: Quote }`, and `id` plus `eventKind` on `ActRef`.

Scenes: `act-focus` (a custom-emoji reaction to the reader's star, with its chain), `acts-open` (a note's focus with
acts unfolded, one unread), `act-react` (the heart on an act's line, on, with its Undo toast).

## N5 Lists

The list kinds are 3 (follows), 10000 (the public part of mutes), 10001 (pins), 10002 (relays), 10003 (bookmarks),
10015 (interests), 10030 (emoji), and the sets 30000, 30002, 30003, 30004, 30005, 30015, 30030 and 39089.
A list as a focus, top to bottom:

1. The context line with the kind's name, and the header with the author and the time of this edition.
2. `image`, when present, in a 3:1 box tinted `--hold`. The title (`title`, else `name`, else `d`, else the kind's
   name) at 17px, weight 600. `description` in `--muted`.
3. `list.items` in faint. Add `list.private` when the list has encrypted content, which is never decrypted here, even
   for the reader's own lists.
4. The items, in the list's order, one per line across the tile, separated by hairlines. Each opens what it is:
   - person: 36px face, name and NIP-05, with Follow as on a profile;
   - event or address: an embedded card (N3);
   - topic: a `#tag` that opens search;
   - link: host and path; opens a browser tab;
   - relay: the address in monospace; a press copies it and shows `list.relayCopied`;
   - word: plain text.
   An emoji set or emoji list draws its emoji as a grid of 48px cells instead. A press on a cell shows the E3 popover
   and does nothing else.
5. The first 100 items, then more as the reader scrolls, within the 800-row window. With no items: `list.empty`.
6. The action row (no reply), then Who reacted (N4).

In the Lists tab and as an embedded card, a list is drawn as the compact card (N3).
Engine (additive): the face `{ type: 'list'; title: string; about?: string; image?: Media; count: number;
private: boolean }`, and `Source` `list` (the items of one list).

Scenes: `list-people` (a people list), `list-bookmarks` (notes, an article and a link), `list-emoji` (an emoji set).

## N6 Articles

- In a row or a card, an article is drawn as the article card, in the quoted-note surface: a 120x88 picture on the
  right (88x88 below 440px, none when absent); the title, weight 600, in two lines; the summary in `--muted`, two
  lines; then the author's 20px face, name and published date. None of the body is shown.
- As a focus, the Thread tab shows a reading view: a 680px measure, centred, on the tile's own background.
  1. `image` at the measure's width in a 2:1 box tinted `--hold`, cover.
  2. The title at 26px / 1.3, weight 600.
  3. The author line: 28px face, name and NIP-05, then `article.published` with the date (`published_at`, else the
     event time), and `article.updated` when this edition is a day or more newer.
  4. The summary in `--muted`, at body size.
  5. The body at note text size plus 2px, line height 1.7. It covers paragraphs, three heading sizes below the
     title, emphasis, links (noopener), lists, block quotes with a `--sep` rule, and pictures in boxes as in notes.
     Code is monospace on `--raised`, and code and tables scroll sideways inside their own block only. A `nostr:`
     person is a name button; a `nostr:` event is an embedded card between paragraphs. HTML in the source is shown
     as text.
  6. The action row, Who reacted, then comments and replies as in T3.
- Engine: Markdown is parsed in the engine into a bounded block list. Additive face: `{ type: 'article'; title;
  summary?; image?: Media; publishedAt?: Millis; blocks?: Block[] }`, with `blocks` only on a focus. Limits: 2,000
  blocks and nesting four deep; anything past them is drawn as plain text.

Scenes: `article-card`, and `article-read` (picture, headings, a list, code, a quote and an embedded note).

## N7 Deep links and copying for every kind

As in N2: `/n/` and `/a/` resolve every kind, and Copy link gives the matching address. An event that cannot be
found is shown in the existing availability state. Scene: `link-any-kind` (a `/n/` link to a 30311, signed out).

## Not in this batch

Writing comments (1111) and editing lists here; adding another person's emoji set to the reader's own; pinned notes
at the head of a profile; faces of their own for live events, calendars, polls and badges (they stay generic until
then).
