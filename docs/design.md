# Design

This document is authoritative for how lkjstr looks and behaves. Where code, older docs or a
reviewer's suggestion disagree with it, this document wins; change it deliberately, in the same
change as the code, never by drift.

## What lkjstr is

A reading and writing instrument for Nostr, built like a tiling window manager. It should feel
like a well-made text editor or a good paper notebook: quiet, exact, fast, and the same every day.
The content is the interface. Chrome recedes until it is needed.

Three rules decide every question:

1. **Ink and paper.** Text on a calm surface. No gradients, no glass, no glow, no decorative
   illustration, no emoji in interface chrome. Shadows only under things that float (menus,
   popovers, dialogs).
2. **Everything is a tile.** Panes meet at one-pixel hairlines with no gaps and no rounded
   corners, like an editor. Cards are for objects inside content (a quoted note, a link, a
   profile summary), never for layout.
3. **Nothing moves under the reader.** No layout shift, no reflow when data arrives, no content
   that jumps. Space is reserved before media loads; new items wait behind a pill.

## The experience

Speed is necessary and not the point. The point is that a person can read, think and answer
without the tool costing them attention. These are promises; a change that breaks one is a bug.

1. **You never lose your place.** Each feed remembers where you stopped and marks it with a thin
   "you were here" line; reloading, switching workspace, or coming back tomorrow returns you to
   it. New notes wait above. When you reach the line the feed says "Caught up" once, quietly.
   After a long absence the feed may offer "While you were away" (a short, clearly labelled
   selection computed on this device from your own network's reactions) above the line; it is
   one dismissible block, never mixed into the timeline.
2. **Opening something never takes away what you were reading.** Detail goes to the neighbour:
   a note, profile or link target opens in the tile to the right; with no tile there, lkjstr
   splits if both halves stay at least 360px wide, otherwise it opens a tab in the same tile.
   A single click opens a *preview tab* (title in italics) that the next preview replaces, so
   browsing does not litter tabs; double-click, any edit, or `Enter` twice keeps it. Ctrl/Cmd
   click opens a kept tab, Shift click splits. Each tab has its own back and forward
   (`Alt+←/→`, mouse buttons, and the browser's Back for the focused tab). The address bar
   always describes the focused tab, so any view can be linked.
   Opening always opens: lkjstr never jumps to an existing tab because it already shows the
   same thing. Two tabs of the same feed, thread or profile are normal (each with its own
   scroll position, filters and history), in one tile, across tiles or across workspaces.
   Only one-of-a-kind system dialogs are exempt.
3. **Everything can be undone.** A closed tab or tile reopens (`Ctrl/Cmd+Shift+T`); a layout
   change steps back (`Alt+Z`); follow, unfollow, mute and delete answer with a five-second
   Undo row; posting holds for five seconds ("Sending in 5 · Undo", adjustable to zero) because
   Nostr has no edit.
4. **The interface tells the truth.** Nothing spins forever: every request settles into content,
   "not found on the 6 relays asked · try more relays", or a plain error with one action. A
   sent note reports "delivered to 5 of 6 relays" and what failed. Counts are labelled as
   lower bounds when they are ("12+"). Anything hidden, reordered or filtered says so and why,
   in place, with a way to see it anyway. Order is newest-first unless the reader chose
   otherwise for that tile, and the choice is shown in the tile.
5. **Strangers are quieter than friends.** Trust is computed on the device from the reader's own
   graph (you, people you follow, people they follow, everyone else). Replies sort by it,
   notifications from the outer ring fold into one row, media from the outer ring is covered
   until pressed, and Global can be narrowed to "my network". It never deletes or blocks on its
   own, and one switch per tile turns it off.
6. **Keys are handled with care.** Reading needs no account. Creating a key takes one step and is
   honest: "Saved on this device only. Back it up before you rely on it", with a quiet reminder
   in the account menu until a backup is made. A secret key is never shown without an explicit
   press and is never placed in a URL, log or error. Every tile that can post shows whose voice
   it will use (avatar beside the send button); switching account in one tile does not change
   another.
7. **It works with hands on the keyboard, on a mouse, or on glass.** Every action has a key and
   shows it; every pointer target is at least 28px (44px on touch); on a phone, swiping moves
   between tabs, pulling down applies new notes, and the thumb reaches everything from the
   bottom bar. Focus is always visible and never lost after a dialog or a tab closes. Screen
   readers get names, roles and live announcements for arrivals behind the pill, not for every
   note.
8. **It is calm.** No streaks, no badges that cannot be cleared, no sounds, no suggested content
   in the timeline, no numbers in colour. The seal dot is the only thing that asks for
   attention, and opening the tile clears it.
9. **It respects the device and the connection.** Offline, it opens to the cache and says so in
   the status. On a metered or slow connection (or by a setting) media loads on press and
   prefetching stops. Text size follows the browser and a setting; nothing breaks at 200% zoom.
10. **Your setup follows you, if you ask.** Layouts, workspaces, settings and read positions can
    be synchronised across the reader's devices as encrypted app data on their own relays
    (NIP-78, NIP-44 to self). It is off until switched on, and says exactly what is stored.

Where the browser offers on-device translation, a note in another language gets a quiet
"Translate" action; nothing is ever sent to a translation service.

## Colour

Two inks carry meaning. **Indigo (藍)** is the colour of action: links, focus, the selected tab,
the primary button, the reader's own reaction. **Vermilion (朱)** is the colour of news, used like
a seal: the unseen dot on a workspace chip or tab, the count on Notifications, the "N new notes"
pill. Vermilion is never used for buttons, links or errors. Errors are a sentence with an icon in
the danger colour, which is a browner red and only ever appears with text.

| Token | Light | Dark |
| --- | --- | --- |
| `--paper` (app background, tile headers) | `#f4f3ee` | `#14161a` |
| `--surface` (tile body, inputs) | `#fdfcf9` | `#1a1d21` |
| `--raised` (menus, popovers, quoted cards) | `#ffffff` | `#21252a` |
| `--hairline` | `#e2e0d8` | `#2a2f35` |
| `--ink` (body text) | `#1c1c1a` | `#e7e5df` |
| `--ink-2` (names of secondary things, icons) | `#55544f` | `#a9a8a2` |
| `--ink-3` (metadata, placeholders) | `#85847d` | `#7d7c77` |
| `--indigo` | `#27598c` | `#8fb4e3` |
| `--indigo-wash` (selected rows, own reaction chip) | `#e3ebf3` | `#1f2c3b` |
| `--seal` | `#d2432c` | `#ec6a4f` |
| `--danger` | `#9c3a23` | `#e08a6d` |
| `--ok` | `#3d7350` | `#86c097` |

The dark theme is its own palette, not an inversion: blue-black paper, warm off-white ink. The
theme follows the system and can be forced in Settings. Every text/background pair in use must
reach 4.5:1 (3:1 for `--ink-3` at 12px and above is not enough: use `--ink-2` for anything a
reader must read). A test computes the contrast of the pairs listed here.

## Type

System fonts only (no web fonts: instant, offline, private):
`system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif`;
keys and ids in `ui-monospace, "SF Mono", "Cascadia Mono", "Noto Sans Mono", monospace`.

| Role | Size / line | Weight |
| --- | --- | --- |
| Note body | 15px / 1.6 | 400 |
| Names, tab titles, buttons | 13.5px / 1.3 | 600 (names), 500 (tabs, buttons) |
| Metadata (time, handles, counts) | 12.5px / 1.3 | 400, tabular numbers |
| Tile and dialog headings | 16px / 1.3 | 650 |
| Long-form article body | 17px / 1.75, measure capped at 38em | 400 |

Japanese and Latin are equal citizens: `line-break: strict`, `overflow-wrap: anywhere`,
`word-break: normal`, `text-autospace`/`text-spacing-trim` where supported. Never truncate a
note's text with an ellipsis in the middle of a feed; fold whole lines instead.

## Space and shape

A 4px grid. Tile header 34px, top bar 38px, note padding 12px 14px, 8px between a note's parts.
Controls are 28px high (36px on touch) with a 6px radius. Tiles and the top bar have no radius.
Avatars are rounded squares (radius 28% of the side): 36px in feeds, 28px in compact density,
20px inline, 72px on profiles. A missing picture is a flat tile in a colour derived from the
public key with the first letter of the name.

Icons are one family, drawn as inline SVG at 16px with a 1.5px stroke in `currentColor`
(Lucide-style geometry). Every icon-only control has a tooltip, an accessible name, and its
shortcut shown as a small key hint in menus.

## The frame

- **Top bar.** Left: the wordmark `lkjstr` (lowercase, 650) and one status dot with a few words
  ("5 relays", "offline, showing cache"). Then the workspace chips. Right: search field that is
  also the command palette (`Ctrl/Cmd+K`), and the account avatar, which opens the account menu.
  No boxed "Sign in" button and no "Shortcuts" link: signing in lives in the account menu and in
  the places that need it; shortcuts live in `?`.
- **Workspace chips.** Fixed-width numbers. The active one is ink on surface with an indigo
  underline; others are `--ink-3`. Unseen activity adds a 5px seal dot at the top right.
- **Tile header.** Plain text tabs, no boxes: the active tab is `--ink` with a 2px indigo
  underline, the others `--ink-3`. Every tab always
  shows its close button; see "Tabs".
  `+` and the tile menu sit at the right in `--ink-3`. The focused tile's header is `--surface`
  and carries a 2px indigo line along its top edge; unfocused headers are `--paper`.
- **Hairlines** separate tiles and notes. A resize handle is the hairline itself, widened to an
  8px hit area, turning indigo while dragged.
- **Phone (under 760px).** One tile fills the screen. A bottom bar with five icons (Home,
  Search, Compose, Notifications, More) replaces the top bar's right side; tabs scroll
  sideways; workspaces and accounts are in More.

## Sizes

A tile can be any size, so every view is designed for its own box, not for the window. Views
respond to the width and height of their tile (container queries), never to the viewport.

| Tile width | Name | What changes |
| --- | --- | --- |
| under 280px | sliver | Avatars 20px inline with the name, body 14px, media as 64px thumbnails, action row reduced to react and more (the rest in the menu), no counts, one-line header with time only |
| 280–439px | narrow | 28px avatars, media full width up to 240px tall, counts shown, handles hidden |
| 440–759px | regular | The numbers in "Space and shape" and "A note" |
| 760px and up | wide | Text measure capped at 42em and centred on feeds; a thread shows the focused note with its replies beside the ancestors; a profile puts the header beside the notes; settings and relays use two columns |

- Height matters too: under 240px a tile hides its secondary rows (filter chips, banners,
  composer toolbar until focused) so at least three lines of content remain; the composer in a
  short tile is one line that grows as it is typed in.
- Nothing is ever cut off or needs sideways scrolling inside a tile, at any size down to the
  minimum of 160×96px. Below the minimum a split is refused with a gentle bounce of the handle.
- Tables (relays, lists) turn into stacked rows when narrow. Dialogs opened from a tile are
  popovers anchored to it and fit inside the window; on a phone they are bottom sheets.
- **Tab strip.** Tabs follow the tile: between 96 and 220px normally; when a tile is too narrow
  for that they shrink to icon plus close button (56px), and under that the strip scrolls. The
  close button stays on every tab at every size. Two settings, per device: tab width ("fit
  title", or a fixed width from 96 to 240px) and interface scale (80–140%, scaling chrome, text
  and controls together while tile geometry stays in real pixels).
- Resizing is live and cheap: content reflows as the handle moves, without re-requesting data,
  losing scroll position (the anchored note stays put) or flashing placeholders.
- Double-clicking a handle equalises the two sides; `Alt+.` and `Alt+,` step by 40px;
  `Alt+Enter` zooms the focused tile to the whole workspace and back.

## Tabs

Tabs are handled all day, so their feel matters more than their look.

- **Closing.** Every tab always shows its close button (`×`, 20px hit area inside a 28px tab,
  `--ink-3`, a round `--hairline` backing on hover). A middle click anywhere on a tab closes it
  (a setting, on by default; the browser's middle-click autoscroll is suppressed on the strip).
  `Alt+W` closes the focused tab. Closing is instant, with no confirmation and no animation,
  and is undone with `Ctrl/Cmd+Shift+T`. A tab holding an unsent draft keeps the draft and
  says so in the Undo row.
- **What gets focus next.** Closing the active tab activates the tab that was active before it
  in that tile, falling back to the right neighbour, then the left. Closing an inactive tab
  changes nothing else.
- **Rapid closing.** While the pointer stays on the strip, tabs keep their width after a close
  so the next `×` arrives under the pointer; widths settle when the pointer leaves.
- **Width.** Tabs share the strip evenly between 96px and 220px, title truncated at the end
  with the full title in a tooltip. When they no longer fit, the strip scrolls sideways (wheel,
  drag, and it keeps the active tab in view) with edge fades, and a small "all tabs" button at
  the end lists them with a filter field.
- **Middle click elsewhere** follows the browser convention: on a note, link, name or avatar it
  opens the target as a kept tab in the background (per the neighbour rule) without moving
  focus; on the empty part of a strip it opens a New tab. Double-click on the empty part does
  the same.
- **Dragging.** A drag starts after 4px of movement, so a click is never mistaken for one. A
  caret shows the insert position in a strip; tile edges show the split preview; a workspace
  chip accepts the tab; `Escape` cancels and the tab returns. Dropping never loses a tab.
- **Menu.** Right click or long press: Close, Close others, Close to the right, Duplicate,
  Keep (for a preview tab), Pin, Move to workspace, Split right, Split down, Copy link, each
  with its key. A pinned tab shrinks to its icon, sits first, and is skipped by Close others.
- **States.** Preview tabs have italic titles. Unseen activity puts a seal dot before the
  title. A tab that is loading shows no spinner; its title is `--ink-3` until content arrives.
- **Last tab.** Closing a tile's last tab closes the tile and gives its room to the neighbour;
  the only tile left becomes a New tab instead.

## A note

```
[avatar]  Name  handle-or-nip05 ................................ 3m
          Body text. Links in indigo, no underline until hover.
          [media, space reserved]   [quoted note as a raised card]
          [reaction chips]
          reply 4   repost 2   react   zap 1.2k   ...
```

- The header is one line: name (600), then the NIP-05 name if it verifies, otherwise a short
  npub, in `--ink-3`; the time is right-aligned, tabular, and absolute on hover. A repost shows
  a one-line "reposted by" row above, in `--ink-3` with the repost icon.
- The action row is icons with counts in `--ink-3`, always visible and quiet; they darken to
  `--ink-2` on hover or when the note is focused. No text labels. Order: reply, repost (menu:
  repost, quote), react, zap, more (copy link, copy id, copy text, bookmark, mute, report, raw
  event, delete if own). A count of zero shows nothing.
- **Reactions** appear as chips under the body: the emoji (or custom emoji image) and a count.
  The reader's own reaction is on `--indigo-wash` with an indigo border. Clicking a chip adds or
  removes the same reaction. Clicking the react icon sends the default reaction (a setting;
  initially ❤️); hovering it for 300ms, a long press, or the `e` key opens the emoji picker.
- **Emoji picker.** A small popover, not a dialog: a search field (focused on open), a "Recent"
  row, the reader's custom emoji sets (NIP-30, from their emoji list and the sets it references)
  with the set name as a small heading, then Unicode emoji by category. Arrow keys move, Enter
  picks, Escape closes. It is the same component in reactions and in the composer.
- **What a click means, everywhere.** An avatar or a name always opens that person's profile;
  the body or time of a note opens that note's thread; a quoted card opens the quoted note. This
  holds in feeds, threads, search, reposts and above all in Notifications: in a row such as "A
  reacted to your note", A's avatar and name open A's profile, and only the excerpt of your
  note opens your note. Grouped rows show each actor's avatar as its own target.
- Focus is a 2px indigo bar on the note's left edge and a `--indigo-wash` background at 50%, not
  an outline box. `j`/`k` move it.
- Threads draw a hairline from avatar to avatar down the left margin; the focused note is at
  full size, ancestors and replies slightly indented, with collapsed runs ("12 more replies").
- Feeds get rhythm from thin date dividers ("Today", "Yesterday", a date) in `--ink-3`.
- Media: images sit in a rounded (8px) frame with reserved space, at most 420px tall in a feed,
  several as a 2-up grid; click opens the image tile. Video and audio are click-to-load.
  Sensitive and content-warned media are covered by a plain surface with the reason.
- Hidden by a heuristic: a single quiet row, "3 notes hidden: repeated text", expandable. The
  interface always says why something is hidden or ordered the way it is.

## Writing

The composer is a tile like any other, plus an inline reply box under a note. The text area is
borderless on `--surface` with the same 15px/1.6 type as notes, so a draft looks like the note
it will become; a live preview is therefore unnecessary. Below it, one row: attach, emoji,
content warning, then character count in `--ink-3` and the primary button (indigo, the only
filled button on screen). `:` completes emoji shortcodes, `@` completes people, `#` completes
hashtags, in the same popover style as the picker. Pasting or dropping an image uploads it and
shows a thumbnail with progress; a failed upload stays as a retryable row. Drafts are saved per
tab and survive reload. `Ctrl/Cmd+Enter` posts.

## Motion and feedback

Almost none. Popovers fade and rise 4px in 120ms; the new-notes pill slides 8px; nothing else
animates. `prefers-reduced-motion` removes even these. No shimmer skeletons: an unloaded avatar
is its flat tile, an unloaded name is the short npub, and they are replaced in place without
changing size. Actions respond instantly and optimistically (a reaction chip appears at once and
shows a small clock until a relay confirms, or an inline "not sent, retry" if none does).

## Words

Interface text is in Japanese and English, chosen from `navigator.languages` and changeable in
Settings; every string goes through one table. Sentences are short and plain: say what happened
and what the reader can do. Empty states are one sentence and one action. No exclamation marks,
no mascots. Times are relative under a day ("3m", "5h"; "3分前" in Japanese), then dates.

## Density

Two densities: comfortable (the numbers above) and compact (28px avatars, 13.5px/1.5 body, 8px
12px padding, media as 96px thumbnails). The choice is per device.

## Review

Any change to the interface is checked against screenshots at 1440×900 and 390×844 in both
themes with realistic mixed Japanese and English content. If a screen looks busy, remove
something before adding anything.
