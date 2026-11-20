# Design

## Purpose
How lkjstr looks and behaves, as built in `web/`. This document and the owner's brief decide questions of look and feel; change it in the same change
as the code. Structure and commands are in [frontend.md](frontend.md).
## Character
A calm reading and writing tool that stays open all day beside other work. It is the same family as ytenrich: the same window manager, tab bars, menus,
launcher, workspaces and settings page, with lkjstr's own colours. When in doubt, do what ytenrich does.

- Text first. The content is the interface; a tab starts with its content: no
  heading repeating the tab title, no explanatory text, no welcome page.
- Tiles meet at hairlines. Rounded corners are for things inside content
  (media 8px, quoted notes 8px, chips, buttons 6px) and for things that float.
- Nothing moves under the reader. Media boxes have their shape before they
  load, counts have fixed slots, a redraw keeps the row on screen where it was.
- A redraw never undoes the reader: what was unfolded, shown, chosen or sorted stays so, with the tab, across a reload.
- Shadows only under what floats: menus, pickers, tab search, toasts.
- A field that has the keyboard is never rewritten or replaced by a redraw; half-typed text stays as typed.

## Colour
Two colours carry meaning and nothing else is coloured: indigo (`--accent`) is action and selection, vermilion (`--seal`) is news (unread, the new-notes
pill). Tokens live at the top of `web/src/ui/ui.css`. `--faint`, the weakest text, still reaches 4.5:1 on `--bg`. The theme follows the device or Settings.

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

## Type
- One system sans stack with the Japanese families named. No web fonts.
- Interface 13.5px / 1.45. Note text 15px / 1.6 (a setting); the focused note of a thread is 1.5px larger. Headers and context lines 12.5 to 13.5px.
- Names are 600; everything else regular. Numbers that change are tabular.
- Note text uses `line-break: strict`. Interface sentences break by phrase in Japanese (`word-break: auto-phrase`), never inside a word.

## The frame
- Top bar, 38px: name, nine workspace chips, tab search, new note, account.
  The name is a menu (Settings, Relays, Stats, Documentation). The relay count is a setting, off.
- Signed in, the account is the active account's face (remembered on the
  device; read-only has a mark) and a menu of the reader's own: their row,
  which opens their profile, the other accounts, and Accounts. Signed out
  it is one filled button, "Sign in", and there is no new-note button.
- At phone width the name gives its place: nine chips and the account fit.
- Tab bars are 1.2 times the interface scale by default. The active tab has
  an indigo underline; every tab shows its close button; middle click closes.
  A full bar scrolls with the wheel, fades toward the side that hides more
  and keeps the tab in front in view. A fixed tab width is a setting.
- The tile that keys go to is marked; `Alt+Shift` chords move between tabs
  and tiles, reopen (the closed-tab list survives a reload) and open. `X`
  closes the tab in front. `O` opens tab search over the tile: open tabs,
  then what a new tab could be; Enter goes there. An empty query omits kinds already open in this tile.
  Tab search also finds the tabs of the other workspaces, marked with their number.
  The New tab page lists each kind once, Documentation among them; a page of it
  (Shortcuts, Terms) comes up once its name is typed. A title that is the typed
  text, or starts with it, goes before a word found in a description.
  `N` goes to the Post tab that is open (a setting: always a new one).
- Menus close on outside press, Escape, scroll and after choosing. No close
  buttons on menus. Shortcuts are a page of Documentation, in the platform's names.
- Opening a note or a person opens a tab in the same tile, right after the current one, in front. Shift-click splits, middle click opens behind.
- The address bar stays `/`; `/n/<note>` and `/p/<npub>` open a tab.
- The default layout, also what "Reset layout" gives: Home at the left
  (Global behind it), Notifications in the middle, and at the right Post over
  Accounts and Settings in equal halves; widths 40/30/30. Under 1200px
  Notifications joins the lower right tile; under 760px one tile. Views
  respond to their tile (container queries).
- A saved arrangement is the reader's until they reset it (tile menu, or
  Settings: Layout); one never rearranged takes up a new default once.
  Reset closes the tabs the default lacks the ordinary way, so what they held
  waits in the closed tabs (as one batch, which later closes do not push out),
  and offers Undo until a tab is opened or closed. Reset every layout does the
  same in every workspace. A device with no room to keep those tabs keeps the
  layout and says so. It touches layout only.
- A list fills its tile. Only media, single form controls and prose pages keep a measure of their own.

## Signed out, and accounts
- A visitor's layout is their own but starts from the same arrangement, with
  Global and the Accounts tab in front (a reader: Home and Accounts).
  No welcome page, no prose. Signing in shows the reader's own layout and
  closes the tab that signed in; signing out shows the visitor's again.
- The Accounts tab is the sign-in surface. It starts with its content: the
  accounts on the device (a press switches; the one in use has an indigo
  tick; each offers its profile), then two actions with nothing between
  them: sign in with a browser extension, create an account. The field for
  an nsec, an npub or a bunker address opens from one quiet line below.
- Keys: the field never echoes, is emptied the moment it is sent, and what
  was typed appears nowhere. A secret key is shown only in the "Back up key"
  box of a local account, covered until "Show" and again when the page is
  hidden. A created account opens on that box. An engine that cannot hand
  a key back is not asked to create one.
- Every way in says what it waits for and, on failure, what happened and what
  to do, in one line under what was pressed; the keyboard returns to it.
- Removing an account that holds a key or a signer connection asks first;
  one that can be had again (extension, public key) goes with Undo.
- A reader who cannot write (signed out, or only a public key) sees it
  before pressing anything: the composer says "Read-only" and Post is off;
  actions that publish are drawn off (those without a count are not shown),
  Follow is off. A press says why in a toast that leads to the accounts. An
  account's own list, signed out, shows Sign in in place of an empty line.
## A note
- Avatar circle (36px, a setting) in its own column; header line with name,
  NIP-05 with a tick when verified, and the time right-aligned. A face
  opens the profile wherever it is drawn, as the name does.
- A person whose name has not arrived is shown by a short npub, never by
  hex. When the name comes only the header line and the face are drawn
  again, so text, folds and loaded pictures stay. Tab titles follow.
- Absolute times under day separators say `HH:mm` when the note and divider share a local day; cross-day reposts retain the original date. Elsewhere older rows include the full date; every time tooltip has the full date and time. Relative time applies in every feed and is off by default.
- Above the header, in `--faint`: who reposted, or what is replied to.
- Text, then media (one picture keeps its ratio up to the media height; two
  to four share a grid), then quoted notes as cards. Long notes fold by whole
  lines. Content warnings cover until pressed. A quoted note that cannot be
  shown is one quiet sentence in the same card.
- Links have up to two distinct 88px cards below text and media, at most 560px wide, aligned with the text, in link order, in the
  quoted-note surface: raised, hairline, 8px corners. Loading reserves the same
  height on hold with the host; failure, timeout or no title closes the slot using the reading anchor. Failed answers reserve nothing for their cache time. Pictures are 120x88
  (88x88 below 440px of tile), cover, absent when unknown. Site is faint 12.5px;
  title 600, two lines; muted description two lines, omitted for two-line titles.
  One accessible link opens a browser tab with noopener; no players or frames.
  Cards fold with long text. Covered notes fetch nothing until opened. Link
  previews are on by default, off with data saver, and disclose the service.
- A zoomed picture is dragged by hand; the wheel zooms about the pointer.
- A picture's box has its final size before the file loads, tinted `--hold`
  (the note's dimensions, otherwise 3:2); a picture of unknown size keeps the
  box's height when it arrives, so nothing below moves. A file that cannot
  be had leaves its box with the host's name; a custom emoji, its code.
- Action row in `--faint` at rest: reply, repost (menu: repost, quote),
  reaction, zap in four equal slots with their counts, then pick an emoji, bookmark and more on the same rhythm, at least 44px apart where the row has 400px. Under 440px of tile the bookmark folds into the
  menu (a set one shows as a mark by the time); under 330px the zap too.
  Reaction chips sit under the row. When chips are drawn the heart has no number; otherwise it carries the total. A trailing `+` means an observed relay limit, never a count still arriving.
- A `+` or empty reaction is a like: drawn and counted as the heart. `-` is 👎.
- On is indigo. Keyboard selection is a wash with an indigo bar at the
  left; unread is a vermilion bar at the left.
## Lists
- New notes are always loaded into the feed as they arrive, after a reload too. At the top they show at once and the list stays at the top. Anywhere else they are inserted above while the reading position holds (the anchor note keeps its place on screen); the pill counts the unread notes above, scrolling up reaches them with no click, and pressing the pill goes to the top. A row selected by the keyboard holds the list too. The feed keeps its bounded window: when more arrive above than the window holds, the pill says so, and pressing it reloads the head.
- The reading position is an anchor note plus offset: it survives reload,
  another tile width, a moved or reopened tab, late media.
- A thread opens on its focused note at the top of the tile. The notes it
  answers are above, joined by a rail in the avatar column that ends in a
  stub on the focused note. Replies are indented by depth, at most four.
- A profile's header (banner, bio, counts, "Follows you") scrolls away with
  the notes. The npub copies on click. A count is shown once it is known;
  until then the label stands alone and still opens the list.
- A list keeps what was read (up to 800 rows): nothing vanishes above and
  the scrollbar keeps its span. A list in time order has a time rail
  instead: it spans every note known for the list, a busy month longer than
  a quiet one without crowding it out and empty time taking no room, dots
  where months begin, numbers where years begin, a 2px accent line across only the rightmost 16px for where you are; the current year uses normal text colour;
  pressed or dragged it goes to that time and says it, and leaves a tick to
  come back by. The tile's own width decides the rail (56px with years from 520px, else 16px) and other tile-width
  layouts (Documentation stacks its tree above the page under 520px) from the first frame. Other views keep a 14px
  scrollbar with a slim thumb that
  widens under the pointer.
- Filters are saved with the tab. The filter row (like the notification
  toggles and the settings search) is the first row of the content: it
  scrolls away, never floats; shown by default, a setting. One query field
  whose placeholder shows what can be typed (words, from:, has:image), a
  period of two days, people to keep, notifications flowing in; own Clear. An unchanged query keeps results and reading position.
  A period accepts common date forms and relative days; it is normalised to yyyy/mm/dd when the field is left.
- A profile lists by kind in tabs under its header: posts, replies,
  reposts, reactions, media. A press anywhere on a notification opens it.
  Notification toggles cover reactions, replies/mentions, reposts and zaps.
- The Channels tab (NIP-28): joined ones first, a rule, the others by
  latest message; a name/address field saves drafts at once. Enter waits for matching
  results. Joined rows show a vermilion unread count; others offer Join.
- A channel is a feed, newest first. Its head and the composer under it are
  the first row and scroll away: the newest end of a chat is its top here.
  The field is free at once. Pending and failed messages stay below it, with
  Retry, Edit and discard for failures, preserving attachments across reload. Elsewhere a message says `# name` above it.
- What the engine cannot serve (protocol below 3; channels: 4) is not drawn.
- Loading, empty, failed and end-of-list are one quiet centred line.
- A profile offers its owner's Home: the notes of the people they follow, as a tab of its own.

## Writing and acting
- The composer is the Post tab: text at note size, who is posting (a button
  that switches accounts), emoji, media, Post. A primary button that cannot
  act yet is neutral. Sending and failed drafts stay below the field; failed Edit swaps keep both drafts.
  Reopened tabs restore drafts; fresh tabs start empty. Hidden composers release mention lookups.
  Delivery counts follow late answers, each post in flight its own; unanswered rows are neutral and disappear on confirmation. Only final all-refused delivery is red.
- Pressing Post empties the field and leaves the caret in it at once, whatever the signer; what is being sent is shown below, and a failure keeps its text.
- At Post, Home shows the retained draft at once with the Sending mark and the room of an action row, as a signed note: a slow
  signer looks like any send. Only a remote signer still waiting after ten seconds gets the remote waiting mark. Refused or failed
  signing keeps the draft with Retry, Edit and discard. The verified event takes the draft's place, by its exact id, without moving it.
- A signed note appears locally in Home, the author's profile and its thread with the existing Sending mark. At the head it follows the live list.
  While reading farther down, the new-notes pill counts arrivals above the held row and says "Your note" with an up arrow
  when the newest above is the reader's own. Pressing the pill returns to the top. Confirmation updates the same row in place.
- `@` and letters offer people under the caret: follows first; Enter takes one.
- One emoji picker serves the composer, reactions and messages ([interface-emoji.md](interface-emoji.md)): search
  and tone, categories, then frequently used, the custom tab (own list and sets) and the Unicode categories. Its strip at the foot
  says what is under the pointer, keyboard or finger, in a fixed space that takes no press; any emoji anywhere,
  custom or Unicode, shows the same in a small popover. Emoji use a colour emoji font before any text font.
- Every wrong click can be taken back. A like or a repost is drawn at once
  and sent only when its Undo toast (8 seconds) has gone, or when the page is
  hidden or closed. Removing a bookmark, a mute or a relay offers Undo too.
- Errors are said in words, in a toast, in the reader's language.
## Settings, Relays, Stats, Documentation
- Settings is ytenrich's settings page in a tab: one searchable list,
  "Group: Name" titles, a description, numbers where a number is meant, a
  mark and a reset on changed entries. Under the search, the group names in
  one quiet line go to their group (the relay list is one press away).
  Settings opens at its top unless it was opened for one entry.
- Relays shows state and changes nothing: one flat list, the reader's own
  first, with state, latency, event counts and why each is there. The list
  is edited in Settings only (the tile menu leads to that entry, and to
  Stats). Media servers offer a few choices with one press, Blossom first.
  A media server is marked as not answering only by a request an upload needs; a server not yet checked is not drawn as down.
- Stats is numbers and quiet marks, no prose: five figures, then a sortable
  row per relay, trouble first; three publication columns group accepted/planned,
  pending/failed and exclusions by own/inbox/capacity limits; absent is a dash.
  Route words, followed-author coverage and weights are sortable columns. Never-connected traffic and all-zero compound cells show one dash; nonzero publication counts show even before a connection. Heads and cells name every compound part in localized tooltips.
  Narrow tiles show Relay, Received and Answer; tapping a row unfolds the other labelled values, one row at a time, retained per tab. Relay names elide inside the host and keep the tail. No horizontal scrolling.
  A second table shows request purposes, weights, counts and completion marks; narrow tiles show Purpose and Relay, with the request id and other values in retained unfolded lines.
- Documentation is one tab with a tree of groups and pages: what lkjstr is, release
  and licence, keys and safety, relays, filters, shortcuts, the privacy
  policy, the terms. A page names its tab and is found by name in tab search.
  Selecting another page opens it at the top; restoring a tab keeps its position.
## Language, and checking the look
Every visible string comes from the two tables in `web/src/shared/`. Japanese is written as Japanese, with no space before particles after a
name. Searching views works in both languages. `pnpm shots` in `web/` writes every scene at 1440, 1024 and 390, in both themes and languages, to
`tmp/screens/`: judge a visual change there (a host without Japanese fonts shows names in the wrong weight).

## Public documentation

The script-free English and Japanese pages at /en/*.html and /ja/*.html use
the same paper, background, ink and action tokens. A plain header offers the
name, a language switch and Open lkjstr. Navigation wraps at phone width; prose
keeps a readable measure. System light/dark preference chooses the palette.
The app remains at /; the public pages never replace its workspace.
