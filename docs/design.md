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
- Relay text has no length limit; rows do. Where a shortened name, address or label still reads (note headers,
  context lines, notifications, account and channel rows, tabs, chips, cards, tab search), it is one line cut with
  an ellipsis, each name on its own so the verb beside it stays, and the whole text is its tooltip. Where the whole
  matters (a profile, its About, note text) it wraps, anywhere if it must. Names are isolated from the text around
  them, so a right-to-left one keeps its order. Nothing pushes a time, an action or a close button out of view; the
  mock's `stress` world and `scripts/smoke-stress.ts` hold this at 1440 and 390.

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
- Editable controls use at least 16px text in every pointer mode. Keep them outside scaled bars so iOS can reveal a
  focused field at normal page zoom (owner, 2026-11-22). If editing starts at normal scale and Safari leaves the page
  enlarged after blur or keyboard dismissal, restore the initial scale. Keep manual pinch zoom available.
  When iOS scrolls the page to lift a field above the keyboard, an open panel (the emoji picker) stays, and the page
  returns to the top after editing (owner, 2026-11-26).
- Names are 600; everything else regular. Numbers that change are tabular.
- Note text uses `line-break: strict`. Interface sentences break by phrase in Japanese (`word-break: auto-phrase`), never inside a word.

## The frame
- Top bar, 38px: name, nine workspace chips, tab search, new note, account.
  The name is a menu (Settings, Relays, Stats, Documentation). The relay count is a setting, off.
- Signed in, the account is the active account's face (remembered on the
  device; read-only has a mark) and a menu of the reader's own: their row,
  which opens their profile, the other accounts, and Accounts. Signed out
  it is one filled button, "Sign in", and there is no new-note button.
- The account is pressed anywhere in the room around its face (34px; 40 by 38 on a touch screen), padding
  included; so are the people in its menu (rows of 36px) and the Accounts tab's rows (44px; 52px on a touch screen).
- Menus from the bar's right end hang under their button, right edges together; the bar's tab search button opens
  tab search there (its key, over the tile), each kept 4px inside the window (owner, 2026-11-25).
- At phone width (owner, 2026-11-22, as ytenrich's masthead) the name stays and tab search, Post and the account stay at
  the right; the chips narrow to 26px and their row gives up the room, scrolling sideways with a fade at a side that
  hides more.
- Tab bars are 1.2 times the interface scale by default. The active tab has
  an indigo underline; every tab shows its close button; middle click closes.
  A full bar scrolls its tabs with the wheel or a finger, fades them toward the side that hides more
  and keeps the tab in front in view; the tile's four buttons never scroll (owner, 2026-11-22). Every tab has one width (95px before the tab scale, a setting; 0 fits each
  to its title): a long title ends in an ellipsis and its tooltip is the whole title. On a phone a full bar narrows
  every tab alike, to 88px, before it scrolls.
- A tile's bar starts with "…" (its menu: the tab's own items, split, reopen, close tile), then two quiet icons,
  maximize and collapse, then "+": the same four, in the same places, whether the tile is open, maximized or collapsed
  (owner, 2026-11-22). The icon of the state the tile is in is indigo and undoes it; the other acts from there.
  Maximized, the tile fills the workspace alone; the others keep their tabs and state behind it, and its indigo
  icon, Escape or `Alt+Shift+F` shows them again. Collapsed, the tile is its bar alone and its siblings take its room:
  in a column a bar of tab titles, in a row an upright strip whose titles read downwards (the fold arrows turn with
  it). Its indigo icon, a press on the bar or a tab, or a tab dropped or opened into it opens it again, and maximize
  fills the workspace with it at once. A lone tile has neither icon; the last open tile of a split cannot collapse. A handle beside a collapsed tile moves the nearest open tiles,
  and the collapsed one keeps its share for when it opens. While a tile is maximized, a tab brought forward in
  another (tab search, tile keys, a reopen) maximizes that tile instead, and a split shows every tile again. Both
  states are layout: saved, shared by browser tabs on the workspace, kept through a reload, cleared by a reset.
- The tile that keys go to is marked; `Alt+Shift` chords move between tabs
  and tiles, reopen (the closed-tab list survives a reload) and open. `X`
  closes the tab in front. `O` opens tab search over the tile: open tabs,
  then what a new tab could be; Enter goes there. An empty query omits kinds already open in this tile.
  Tab search also finds the tabs of the other workspaces, marked with their number.
  The New tab page lists each kind once, Documentation among them; a page of it
  (Shortcuts, Terms) comes up once its name is typed. A title that is the typed
  text, or starts with it, goes before a word found in a description.
  `N` goes to the Post tab that is open (a setting: always a new one).
- Menus close on outside press, Escape, a list's scroll and after choosing. No close
  buttons on menus. Shortcuts are a page of Documentation, in the platform's names.
- Opening a note or a person opens a tab in the same tile, right after the current one, in front. Shift-click splits, middle click opens behind.
  Nothing opens in another tile by itself, and nothing takes the place of the tab being read: closing an opened
  tab brings back the one it came from (owner, 2026-11-22).
- Incoming note, profile and address paths open a Thread or Profile tab, then
  return the address bar to `/`. An invalid path keeps the workspace as it was
  and shows one toast.
- The default layout, also what a reset gives: Home at the left (lkjsxc's Home behind it: the people the maker of
  lkjstr follows, in Global's old place), in the middle Documentation open at what lkjstr is, in front of
  Notifications, and at the right Post over Accounts and Settings in equal halves; widths 40/30/30. Under 1200px
  the middle tile joins the lower right one. Under 760px at first open (a phone; owner, 2026-11-22) one tile holds
  the rest over Post collapsed to its bar at the bottom (60/40 once opened), and there is no Notifications tab: the
  reader's Home starts with notifications flowing in (its filter's Notifications: Show; that narrows nothing, so
  it neither marks the filter as set nor goes with Clear). Views respond to their tile (container queries).
- A saved arrangement is the reader's until they reset it (Settings: Layout); one never rearranged takes up a
  new default once.
  Reset closes the tabs the default lacks the ordinary way, so what they held
  waits in the closed tabs (as one batch, which later closes do not push out),
  and offers Undo until a tab is opened or closed. Reset every layout does the
  same in every workspace. A device with no room to keep those tabs keeps the
  layout and says so. It touches layout only.
- A list fills its tile. Only media, single form controls and prose pages keep a measure of their own.

## Signed out, and accounts
- A visitor's layout is their own but starts from the same arrangement, with
  lkjsxc's Home, Documentation and the Accounts tab in front (a reader: Home,
  Documentation and Accounts); on a phone a visitor starts on Documentation,
  a reader on Home. No welcome page: what lkjstr is, is the ordinary
  Documentation tab. Signing in shows the reader's own layout and
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
- A note that names its client says so by its time: "via {name}" in `--faint`, 12px, on the same line, the first
  thing in the header to give way and not drawn under 340px of tile ([interface-client.md](interface-client.md)).
  The name is relay text, drawn as text and bounded. With a handler address it is a button: a press asks once and
  shows the verified app's name and site, or that it could not be verified; nothing navigates by itself.
- A person whose name has not arrived is shown by a short npub, never by
  hex. When the name comes the header line is redrawn and the face's initial
  updates in place. Text, folds and loaded pictures stay. Tab titles follow.
- Absolute times under day separators say `HH:mm` when the note and divider share a local day; cross-day reposts retain the original date. Elsewhere older rows include the full date; every time tooltip has the full date and time. Relative time applies in every feed and is off by default.
- Above the header, in `--faint`: who reposted, or what is replied to.
- Text, then media (one picture keeps its ratio up to the media height; two
  to four share a grid), then quoted notes as cards with their own text, media and
  links. A further quote is a link line. One height limit covers the whole
  rendered body, including reserved media boxes, quotes and link cards. The
  limit is measured in note line heights. A folded body fades out over its
  last lines above a quiet centred Show more pill. It opens the body in place
  and becomes Show less, which folds it again. Bodies within the limit show
  in full. Quote text that exceeds six lines fades over its last visible lines.
  Content warnings cover until pressed. A quoted
  note that cannot be shown is one quiet sentence in the same card.
- Until it arrives, the short npub is muted at weight 500. The name that replaces it fades in once (0.24s, from
  0.35 opacity) in every tile drawing it then; later redraws and reduced motion draw it plainly. Each tile lays out
  and paints alone (`contain: layout paint style`), so a row arriving in one tile never re-lays out its neighbours.
- Links have up to two distinct 88px cards below text and media, at most 560px wide, aligned with the text, in link order, in the
  quoted-note surface: raised, hairline, 8px corners. Loading reserves the same
  height on hold with the host; failure, timeout or no title closes the slot using the reading anchor. Failed answers reserve nothing for their cache time. Pictures are 120x88
  (88x88 below 440px of tile), cover, absent when unknown. Site is faint 12.5px;
  title 600, two lines; muted description two lines, omitted for two-line titles.
  One accessible link opens a browser tab with noopener; no players or frames.
  Cards count toward the note's height. Covered notes fetch nothing until opened. Link
  previews are on by default, off with data saver, and disclose the service.
- A press on a picture opens the note's pictures as a new tab right after the one being read, in the same tile;
  Escape or the tab's × closes it and brings that tab back where it was. A picture handles like a map (owner,
  2026-11-22): a finger or the mouse drags it and a release carries it on, slowing down; two fingers pinch about
  where they are while they move it; the wheel zooms about the pointer; a double tap or double click goes closer, or
  back to the whole picture, about that point (a single click does nothing). Jumps in scale slide in 220ms. The
  percentage in its bar is a handle, a pill with a grip: held and slid right or up it zooms twice as close per 100px
  about the middle, left or down away, without an end (slid again, it goes on), so one finger zooms; a press fits or
  goes closer. The scale runs from a 32px picture to 256 times its size; let go within 5% of the fit, it fits.
  From four screen pixels per picture pixel the pixels show as they are.
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
- New notes are always loaded into the feed as they arrive, after a reload too. At the top they show at once and the list stays at the top. Anywhere else they are inserted above while the reading position holds (the anchor note keeps its place on screen); the pill counts the unread notes above, scrolling up reaches them with no click, and pressing the pill goes to the top (at once when the arrivals are already drawn above). A row selected by the keyboard holds the list too. The feed keeps its bounded window: when more arrive above than the window holds, the pill says so, and pressing it reloads the head.
- The reading position is an anchor note plus offset: it survives reload,
  another tile width, a moved or reopened tab, late media.
  While the reader moves the list (a finger on it, or a scroll in the last 150ms), nothing writes the scroll, so a
  fling coasts on (owner, 2026-11-25): rows above that change height shift the list instead, and the shift goes into
  the scroll once the list rests (owner, 2026-11-26).
- For 0.4s after rows move under the finger (a reaction, an arrival at the top, a row that grows), a tap on a moved
  note, notification, or one of its controls is ignored. The reply form remains usable while it grows (owner, 2026-11-26).
- A thread ([interface-thread.md](interface-thread.md)) opens on its focused note about a third down the tile, with
  what it answers in view above it, whole, its text 1.5px larger, untinted; the reply field is under it. The notes it
  answers are above, compact (two lines and the action row, one height) and joined by a rail that ends in a stub on
  the focus; more than three fold behind one row. Reply anywhere (a list, Notifications, a profile, R) opens the
  note's thread in the same tile with the keyboard in that field; nothing opens a separate reply screen.
  Replies read as a conversation: one step in at most, quiet elbows in `--sep`, whom a reply answers above its
  header when its line does not say it, branches past three folded. Thread times carry the date (date alone under 340px). A note still
  looked for, or not found, holds the room of the note it would be; skeletons hold the focus and first replies.
- A profile's header (banner, bio, counts, "Follows you") scrolls away with
  the notes. The npub copies on click. A count is shown once it is known;
  until then the label stands alone and still opens the list.
- The reader's own header, when that account can publish, offers Edit profile: a tab after the profile with a live
  preview (banner, face, name), the picture and banner as an address or an upload, then the other fields; Save
  closes it, a failure stays in words under the buttons ([interface-profile.md](interface-profile.md)).
- A list keeps what was read (up to 800 rows): nothing vanishes above and
  the scrollbar keeps its span. A list in time order has a time rail
  instead: it spans the notes available to read by rank, as a native scrollbar
  would, so busy weeks keep their room over a few short old posts; a quiet month stays reachable and empty time
  takes none. An isolated stretch of sparse old notes shares a short end band, with every note still reachable.
  A 6x32px accent grip in the rightmost 16px marks the reading place, with 4px beyond it at both ends.
  It appears with the first dated row at the share scrolled, beside provisional marks from the loaded rows. The counted rank map and its marks take over as counts arrive.
  Hover and hold highlight it. On a tile of 520px or more, the right-aligned ruler starts at local years.
  A gutter separates the labels from ticks on the grip axis. Each labelled span shows its next unit when
  the rank map gives it room, from months and days through hours, quarter hours and five minutes. Rounder boundaries are darker, by colour and weight alone (owner, 2026-11-27):
  labels and their ticks mix `--fg` into `--paper` on one ladder, 50% for :05 up 3.5% a rank to 92% for years,
  through :10, :15/:45, :30, hours, 06/18, 12, midnight, days, the 11th/21st, the 1st, quarter months and January.
  Years are also larger and 600, the current year in text colour. Finer ticks can stand without a label. While held, a short column around the pointer shows one finer
  unit with the reading time still beside the grip. A fine pointer draws a `--sep` line and the time under it.
  Pressed or dragged it goes to that time (near a label, to that period's newest note), says the day while it loads,
  and leaves a thin tick to come back by; `[` and `]` step a day, Backspace returns
  ([interface-time.md](interface-time.md) C2, C3). The tile's own width decides the rail (56px from 520px, else 16px
  with years shown on hover) and other tile-width layouts (link-card pictures, the folded action row) from the first
  frame. An eligible view keeps the track while empty and shows its grip, marks and scroll-share navigation
  as soon as it has dated rows. Partial, late or unexpected data can delay exact counts and ordinal seeks.
  Views outside the supported scope keep a 14px scrollbar with a slim thumb that widens under the pointer.
- Home and other merged chronological lists end at the time their expected
  sources have reached. The rail ends at the same place. Older notes appear
  in order as pages arrive, with the usual quiet loading end in the meantime.
  A source at its end or without a page answer after four seconds releases its hold.
- While the reader scrolls a list in time order (wheel, touch, keys, a dragged thumb or rail), a small label beside
  the rail grip or native thumb says `yyyy/mm/dd HH:mm` of the row at the top, kept 4px
  inside the tile. On the rail, touching the list or moving a pointer over the rail also shows it. It fades after a
  second of idle, leaving the rail available. A scroll the list makes itself shows nothing
  ([interface-time.md](interface-time.md) C1).
- Filters are saved with the tab. The filter row (like the notification
  toggles and the settings search) is the first row of the content: it
  scrolls away, never floats; shown by default, a setting. One query field
  whose placeholder shows what can be typed (words, from:, has:image), a
  period of two days, people to keep, notifications flowing in; own Clear. An unchanged query keeps results and reading position.
  A period accepts common date forms and relative days; it is normalised to yyyy/mm/dd when the field is left.
- A profile lists by kind under its header: Posts, Replies, Reposts, Reactions, Media, Articles, Lists, All. Posts includes reposts by default and has a saved Reposts Show/Hide filter under the header. The selected tab is revealed once measurable on mount or selection; header replacements and returning to a hidden tab preserve the reader's horizontal position.
  Public lists use the generic face until N5; authored act rows have no action row or reaction chips until S6 defines their targets. A press anywhere on a notification opens it.
  Notification toggles cover reactions, replies/mentions, reposts and zaps.
- The Channels tab (NIP-28): joined ones first, a rule, the others by
  latest message; a name/address field saves drafts at once. Enter waits for matching
  results. Joined rows show a vermilion unread count; others offer Join.
- A channel is a feed, newest first. Its head and the composer under it are
  the first row and scroll away: the newest end of a chat is its top here.
  The field is free at once. Pending and failed messages stay below it, with
  Retry, Edit and discard for failures, preserving attachments across reload. Elsewhere a message says `# name` above it.
- What the engine cannot serve (protocol below 3; channels: 4) is not drawn.
- Loading, empty, failed and end-of-list are one quiet centred line (a thread holds skeletons instead).
- A profile offers its owner's Home: the notes of the people they follow, as a tab of its own.
- A note's time opens that Home around the note's moment ([interface-moment.md](interface-moment.md)): a tab of its
  own, `name yyyy/mm/dd hh:mm`, with no live head and no filter row. A moment line where the time falls carries the
  author's face, the time, the follow list's own date and "From this device only" while that is true; each end says
  its own state. The text of a note still opens its thread.

## Writing and acting
- The composer is the Post tab: text at note size, who is posting (a button
  that switches accounts), content warning, emoji, media, Post. A primary button that cannot
  act yet is neutral. Sending and failed drafts stay below the field; failed Edit swaps keep both drafts.
  Reopened tabs restore drafts; fresh tabs start empty. A picture shows from the moment it is chosen; pressed, it opens
  full size in a media tab, as in a note (owner, 2026-11-26). Hidden composers release mention lookups.
- Quote (the repost menu) writes in the Post tab, never over what is being read: an open Post tab holding nothing
  takes the quote; otherwise a new Post tab opens right after the read tab, in its tile. The keyboard goes into the
  field. The quoted note is a card under the field and the media, in the quoted-note surface: face, name, time, its
  first four lines (or its warning) and a media count, × in its corner to drop it. A quote needs no text to post.
- The content warning is a button in the composer's bar, indigo while on; on, a one-line reason (optional) stands
  over the text, dashed like the cover readers will see. The note goes out with it, and while it sends Home shows
  the same cover. Every composer has it: Post, a thread's field, a channel.
- @ in any composer (Post, the field under a thread's focus, Quote, a channel) opens one person picker at the caret, or
  above it when there is more room there. A bare @ offers the answered note's author, its thread's people, then follows;
  a name, NIP-05 address or npub narrows or finds one. Arrows with Enter or Tab, or a tap, choose; Escape closes. No match
  is one quiet line and Enter stays a new line. Chosen people are chips under the field, and a waiting or failed draft
  already shows them as the links the published note will have.
- Sent appears on the first accepting relay answer. Each post keeps its own count as later answers arrive. The composer lists at most five
  refused or unanswered relays and points to the remaining count. A signed note keeps retrying quietly with its attempt count and a Remove
  control. The same event resumes on reconnect, network return, tab return and reload. A hard refusal leaves Edit and Remove.
- Pressing Post empties the field and leaves the caret in it at once, whatever the signer; what is being sent is shown below, and a failure keeps its text.
  On a touch screen a tap on Post puts the on-screen keyboard away instead (owner, 2026-11-25); the send key keeps the caret.
- At Post, Home shows the retained draft at once with the Posting mark and the room of an action row, as a signed note: a slow
  signer looks like any send. Posting (投稿中) holds until the note is signed, since nothing has left the browser yet; Sending
  (送信中) starts with the signature. An extension or remote signer still waiting after ten seconds gets its own waiting mark. Refused or failed
  signing keeps the draft with Retry, Edit and discard. The verified event takes the draft's place, by its exact id, without moving it.
- A signed note appears locally in Home, the author's profile and its thread with the existing Sending mark. At the head it follows the live list.
  While reading farther down, the new-notes pill counts arrivals above the held row and says "Your note" with an up arrow
  when the newest above is the reader's own. Pressing the pill returns to the top. The same row shows its time after confirmation, or remains marked unconfirmed.
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
  mark and a reset on changed entries. The list starts right under the
  search: no index of groups. Settings opens at its top unless it was opened
  for one entry (the relay list, from the Relays tab).
- Relays shows state and changes nothing: one flat list, the reader's own
  first, with state, latency, event counts and why each is there. The list
  is edited in Settings only (the tile menu leads to that entry, and to
  Stats). A press on a relay opens a Relay tab ([interface-relay.md](interface-relay.md)): that relay alone, apart
  from the reader's relays, headed by what it says about itself (NIP-11), then the notes it served as a dated feed
  with the time rail. It changes nothing either. Media servers offer a few choices with one press, Blossom first.
  A media server is marked as not answering only by a request an upload needs; a server not yet checked is not drawn as down.
- Stats has four figures and the Signer card, then a sortable
  row per relay, trouble first; three publication columns group accepted/planned,
  pending/failed and exclusions by own/inbox/capacity limits; absent is a dash.
  Route words, followed-author coverage and weights are sortable columns. Never-connected traffic and all-zero compound cells show one dash; nonzero publication counts show even before a connection. Heads and cells name every compound part in localized tooltips.
  Narrow tiles show Relay, Received and Answer; tapping a row unfolds the other labelled values, one row at a time, retained per tab. Relay names elide inside the host and keep the tail. No horizontal scrolling.
  Stats shows a plain empty state until the first measurement and keeps the last measured figures through missed polls.
  The Signer card reuses the figures' style and places labels left and values right. It updates at most once per second and
  shows a muted line while waiting or when the extension is absent.
  A second table shows request purposes, weights, counts and completion marks; narrow tiles show Purpose and Relay, with the request id and other values in retained unfolded lines.
- Documentation is one tab and one page (owner, 2026-11-22): its contents come first, groups side by side where
  there is room, then every part in order: what lkjstr is, release and licence, keys and safety, messages, relays,
  filters, shortcuts, the privacy policy, the terms. An entry slides the tab to its part (at once with reduced
  motion); each part ends with a small "↑ Contents" that slides back to the contents, on that part's entry, marked.
  The address bar never changes (no fragment). A part is found by its name in tab search and opens a Documentation
  tab there; restoring a tab keeps its position.
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
