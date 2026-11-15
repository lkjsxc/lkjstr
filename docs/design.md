# Design

## Purpose

How lkjstr looks and behaves, as built in `web/`. This document and the
owner's brief decide questions of look and feel; change it in the same change
as the code. Structure and commands are in [frontend.md](frontend.md).

## Character

A calm reading and writing tool that stays open all day beside other work.
It is the same family as ytenrich: the same window manager, tab bars, menus,
launcher, workspaces and settings page, with lkjstr's own colours. When in
doubt, do what ytenrich does.

- Text first. The content is the interface; a tab starts with its content: no
  heading repeating the tab title, no explanatory text, no welcome page.
- Tiles meet at hairlines. Rounded corners are for things inside content
  (media 8px, quoted notes 8px, chips, buttons 6px) and for things that float.
- Nothing moves under the reader. Media boxes have their shape before they
  load, counts have fixed slots, a redraw keeps the row on screen where it was.
- Shadows only under what floats: menus, the emoji picker, toasts.

## Colour

Two colours carry meaning and nothing else is coloured: indigo (`--accent`)
is action and selection, vermilion (`--seal`) is news (unread, the new-notes
pill). Tokens live at the top of `web/src/ui/ui.css`.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paper` | `#f4f3ee` | `#14161a` | Frame, tab bars, day dividers |
| `--bg` | `#fdfcf9` | `#1a1d21` | Tile content |
| `--raised` | `#ffffff` | `#21252a` | Menus, quoted notes, fields |
| `--hold` | `#eae8e0` | `#262a30` | The box of a picture that has not loaded |
| `--line`, `--sep` | `#e2e0d8`, `#cfcdc4` | `#2a2f35`, `#3a4048` | Hairlines; stronger rules and rails |
| `--fg` | `#1c1c1a` | `#e7e5df` | Text |
| `--muted` | `#55544f` | `#a9a8a2` | Secondary sentences, inactive tabs |
| `--faint` | `#706f69` | `#8c8b85` | Times, NIP-05, counts, icons at rest |
| `--accent`, `--wash` | `#27598c`, `#e3ebf3` | `#8fb4e3`, `#1f2c3b` | Links, active marks; their tint |
| `--seal` | `#d2432c` | `#ec6a4f` | Unread bar, new-notes pill |

`--faint` is the weakest text colour and still reaches 4.5:1 on `--bg` in
both themes. The theme follows the device or is set in Settings.

## Type

- One system sans stack with the Japanese families named (Hiragino, Noto
  Sans CJK JP, Noto Sans JP, Yu Gothic UI, Meiryo). No web fonts.
- Interface 13.5px / 1.45. Note text 15px / 1.6 (a setting); the focused note
  of a thread is 1.5px larger. Headers and context lines 12.5 to 13.5px.
- Names are 600; everything else regular. Numbers that change are tabular.
- Note text uses `line-break: strict`. Interface sentences break by phrase in
  Japanese (`word-break: auto-phrase`), never inside a word.

## The frame

- Top bar, 38px: name, nine workspace chips, new note, account. The name is
  a menu of the tabs about lkjstr itself (Settings, Relays, Shortcuts, About).
  The relay count is shown only when enabled in Settings.
- Signed in, the account is the active account's face (remembered on the
  device, so a reload shows it in its first frame; a read-only account has a
  mark on it) and a menu that switches accounts. Signed out it is one filled
  button, "Sign in", that opens the Accounts tab; there is no new-note button.
- At phone width the name gives its place: nine chips and the account fit.
- Tab bars are 1.2 times the interface scale by default. The active tab has
  an indigo underline; every tab shows its close button; middle click closes.
  A full bar scrolls with the wheel, fades toward the side that hides more,
  keeps its scroll through redraws and always keeps the tab in front in view.
- The tile that keys go to is marked; `Alt+Shift` chords move between tabs
  and tiles, close, reopen (the closed-tab list survives a reload) and open.
- Menus close on outside press, Escape, scroll and after choosing. No close
  buttons on menus. Keyboard shortcuts are listed in an ordinary tab, with
  key names of the platform.
- Opening a note or a person opens a tab in the same tile, right after the
  current one, in front. Shift-click splits, middle click opens behind.
  Duplicates are fine; nothing jumps to an existing tab.
- The address bar stays `/`. `/n/<note>` and `/p/<npub>` open a tab and the
  address returns to `/`.
- Layout by window width when nothing is stored: three tiles at 1440, two at
  1024, one at 390. Views respond to their tile (container queries), never to
  the window.
- A list in a tile wider than a page keeps a 720px measure in its middle.

## Signed out, and accounts

- A visitor gets a layout of their own: one tile of Global, no empty tile,
  no welcome page, no prose. Signing in shows the reader's own layout (the
  ordinary one until they arrange it) and closes the tab that signed in;
  signing out shows the visitor's layout again, as it was left.
- The Accounts tab is the sign-in surface. It starts with its content: the
  accounts on the device (a press switches; the one in use has an indigo
  tick), then one row per way in: a browser extension, a field for an nsec,
  an npub or a bunker address, a new account.
- Keys: the field never echoes, is emptied the moment it is sent, and what
  was typed is kept nowhere and appears in no message. A secret key is shown
  only in the "Back up key" box of a local account, covered until "Show",
  covered again when the page is hidden, and dropped when the box closes.
  A created account opens on that box before anything else. An engine that
  cannot hand a key back is not asked to create one.
- Every way in says what it waits for and, on failure, what happened and what
  to do, in one line under the control pressed; the keyboard returns to it.
- Removing an account that holds a key or a signer connection asks first, in
  the row. One that can be had again (extension, public key) goes with Undo.
- A reader who cannot write (signed out, or an account that is only a public
  key) sees it before pressing anything: the composer names the account
  "Read-only" and Post is off (signed out it is "Sign in"); on notes the
  actions that publish are drawn off, counts stay legible, the ones without
  a count are not shown; Follow is off. A press on any of them says why in a
  toast that leads to the accounts. A list that belongs to an account, opened
  signed out, shows the Sign in button in place of an empty line.

## A note

- Avatar circle (36px, a setting) in its own column; header line with name,
  NIP-05 with a tick when verified, and the time right-aligned.
- A person whose name has not arrived is shown by a short npub (the first
  ten characters, an ellipsis, the last four), never by hex. The name takes
  its place when it comes: only the header line and the face are drawn
  again, so the text, an opened fold and loaded pictures stay as they are.
  Tab titles follow.
- Times are absolute: `HH:mm` within the day, `yyyy/mm/dd` otherwise and on
  day dividers. Relative time is a setting, off by default.
- Above the header, in `--faint`: who reposted ("A, B and 3 others"), or what
  is being replied to.
- Text, then media (one picture keeps its ratio up to the media height; two
  to four share a grid), then quoted notes as cards. Long notes fold by whole
  lines. Content warnings cover until pressed. A quoted note that is missing,
  deleted, muted or that no relay answered for is one quiet sentence in the
  same card.
- A picture's box has its final size before the file loads, tinted `--hold`:
  from the note's dimensions when it gave them, otherwise 3:2. A picture of
  unknown size keeps the box's height when it arrives (a narrower one draws
  the box in, a wider one is cropped at the sides), so nothing below moves.
  A file that cannot be had leaves its box with the host's name. A custom
  emoji that cannot be had is its code as text.
- Action row in `--faint` at rest: reply, repost (menu: repost, quote), pick
  an emoji, like, zap, bookmark, more. Counts sit in fixed slots. Under 440px
  of tile the bookmark folds into the menu (a set one shows as a mark by the
  time); under 330px the zap too. Reaction chips sit under the row.
- An action that is on is indigo. Selection by keyboard is a wash with an
  indigo bar at the left. Unread is a vermilion bar at the left.

## Lists

- At the top of a feed new notes flow in by themselves. Anywhere else the
  position holds and a pill counts what is above.
- The reading position is an anchor note plus offset, not a scroll offset. It
  survives reload, another tile width, a moved or reopened tab, late media.
- A thread opens on its focused note at the top of the tile, in the same
  frame as its rows. The notes it answers are above, joined by a rail in the
  avatar column that ends in a stub on the focused note, so it is plain there
  is more above. Replies are indented by depth, at most four steps.
- A profile's header (banner, bio, counts, "Follows you") scrolls away with
  the notes. The npub is underlined, on one line, and copies on click. A
  count is shown once it is known: absent, or a lower bound of nothing, shows
  the label alone, which still opens the list.
- Filters are part of the tab and saved with it. Notifications filter by
  type with icon toggles.
- Loading, empty, failed and end-of-list are one quiet centred line; hovering
  it shows the last arrival time.

## Writing and acting

- The composer is a tab: text at note size, who is posting, emoji, media,
  Post. Who is posting is a button that switches accounts. A primary button
  that cannot act yet is neutral, not pale indigo. Only the most recent
  result is shown below.
- Every wrong click can be taken back. A like or a repost is drawn at once
  and sent only when its Undo toast (8 seconds) has gone, or when the page is
  hidden or closed, so Undo means it was never sent. Removing a bookmark,
  a mute or a relay offers Undo too.
- Errors are said in words, in a toast, in the reader's language.

## Settings, Relays, About

- Settings is ytenrich's settings page in a tab: one searchable list,
  "Group: Name" titles, a description, numbers where a number is meant, a
  mark and a reset on changed entries.
- Relays shows state and changes nothing: relays in use first, with state,
  latency, event counts and what each is used for in words; relays not in
  use are folded away with the reason. The reader's relay list is edited in
  Settings only (add, read and write switches, remove with Undo); the tile
  menu of Relays opens Settings on that entry.
- About has the version, the repository, the privacy policy and licences.

## Language

Every visible string comes from the two tables in `web/src/shared/`.
Japanese is written as Japanese, with no English sentence left in it, and no
space before particles after a name. Searching views works in both languages
whatever the interface language.

## Checking the look

`pnpm shots` in `web/` writes every scene (among them a visitor's first run,
the sign-in surface and the accounts) at 1440, 1024 and 390, in both themes
and both languages, to `tmp/screens/`. Judge a visual change there,
and note that a host without Japanese fonts shows names in the wrong weight.
