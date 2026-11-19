# Frontend

## Purpose

How the interface in `web/` is built, where things live, where it stops and
the engine begins, and how to run its gates. The look and the interaction
rules are in [design.md](design.md); what the static host must do is in
[hosting-needs.md](hosting-needs.md).

## Shape

TypeScript with no framework, built the way ytenrich is: `h()` for DOM,
small signals, `create*` factories instead of classes, one stylesheet set,
esbuild for bundling. The main thread draws and nothing else: it never parses
an event, opens a socket or touches the event store. Everything that is not
pixels belongs to the engine, which runs in a Worker.

The default development worker is the mock engine (`src/engine/mock/`), which is also the
test double. The Rust/WASM engine replaces it at build time with
`--engine=<dir>`; nothing in the interface changes.

## Layout of `web/`

| Path | What it holds |
| --- | --- |
| `src/main.ts`, `src/boot.ts` | Start: theme and scale before first paint, engine, window manager, incoming `/n/` and `/p/` links |
| `src/engine/protocol.ts` | The contract with the engine. Owned by the frontend; the engine mirrors it |
| `src/engine/client.ts` | Subscriptions, actions as promises, hints, NIP-07 signing requests |
| `src/engine/mock/` | Mock engine and fixtures (Japanese and English notes, media, threads, slow and failing relays) |
| `src/wm/` | Window manager adapted from ytenrich: layout tree, controller, strips, tab drag, resize, menus, launcher, workspaces, store |
| `src/views/` | One file per kind of tab or piece of one; `registry.ts` lists the kinds |
| `src/shared/` | `h`, signals, settings, storage, i18n and the two string tables, key table, formats, icons |
| `src/ui/*.css` | All styles: `ui.css` (frame, WM), `notes.css`, `views.css`, `people.css`, `pages.css` |
| `src/static/` | Static privacy policy and public-page stylesheet |
| `scripts/` | `build.ts`, `serve.ts`, `check.ts`, `smoke.ts`, `shots.ts` |
| `tests/` | vitest: layout, words, keys, formats, undo, the mock engine |

Seams worth knowing inside `src/views/`:

- `feed.ts` is every list of rows (home, global, hashtag, search, bookmarks,
  thread, profile, people, notifications). It decides which window of rows to
  ask for. `feed-draw.ts` turns rows into nodes, `feed-place.ts` keeps the
  reading position as an anchor row plus offset, `feed-keys.ts` is the
  keyboard, `feed-bar.ts` and `filter-bar.ts` are the filter row,
  `feed-scrub.ts` the time beside a held scrollbar, `profile-kinds.ts` the
  kinds of a profile. `docs.ts` is the Docs tab (its pages include the
  shortcuts and the release facts of `pages.ts`); `wm/tab-search.ts` finds
  a tab.
- `note.ts` draws a note, `note-media.ts` its pictures, `note-actions.ts`
  its action row and menus, `held.ts` holds a like or repost back until its
  Undo has lapsed.
- `account.ts` is the Accounts tab, `account-add.ts` the ways to sign in,
  `account-key.ts` owns protected backup and its folded raw-key part. Password
  forms are disposable; account-vault.ts routes unlock, account-idle.ts locks idle
  protected sessions. `can.ts` says
  whether the reader can write and what a press says when they cannot.
- `channels.ts` is the Channels tab, `channel-desk.ts` the head and the
  composer of a channel tab (which is `feed.ts`), `channel-parts.ts` what
  both share. `gated.ts` keeps a view from an engine too old to serve it.
  `compose-media.ts` retains failed files and their retry/server controls;
  `stats.ts` is the Stats tab (`Engine.stats()`, asked while in front).
- `wm/presets.ts` has two layout families: `main` for an account and `guest`
  for a visitor; `main.ts` shows the one that fits who is signed in.
- `wm/controller.ts` owns one workspace; `wm/closed.ts` is its stored list of
  closed tabs, `wm/choices.ts` what the New tab page offers.

## The engine boundary

`protocol.ts` is plain structured-clone messages:

- `open {sub, query}`, `window {sub, anchor, before, after}`, `close {sub}`
  from the interface; `rows`, batched `patch`, `fresh` and `state` back. A row
  is a finished view model; the interface virtualises and never reorders.
- `act {req, action}` with a `result`, `publish.signed` for the signed note id, and
  `progress` or per-relay `delivery`. A publication result can settle before
  the remaining relay answers. The composer retains delivery callbacks while its
  result is displayed; unsettled sends can survive a remount. When the last send
  settles without a mounted composer, the current delivery watch is released.
  Optional `hint.deliveryWatches` names retained action requests, at most 128 per client.
- `sign` from the engine when the account uses a browser extension, answered
  with `signed` (NIP-07 exists only on the main thread). `getPublicKey` is
  answered by the real transport itself, and by `client.ts` for the mock.
- Accounts: `account.add` (extension, key, create), `account.use`,
  `account.remove`, and since protocol 2 `account.key`, whose result carries
  the `nsec` of a local account for the "Back up key" box. The interface
  offers "Create a new account" only to an engine that reports 2 or more.
- Protocol 3 adds the query fields `phrases`, `exclude`, `has`, `from`,
  `notifications` and `show`. The interface draws their controls only for an
  engine that reports 3 (`views/can.ts`: `rich`).
- Protocol 5 adds optional `NoteRow.previews`, `linkPreviews` configuration,
  and the `preview` near-note hint. The Worker probes same-origin health once;
  absent service means absent cards. UI hints carry ids, never parsed links.
- Protocol 4 adds channels (NIP-28): the sources `channels` and `channel`,
  `ChannelRow`, `NoteRow.channel`, `Draft.channel` and the actions
  `channel.join`, `channel.save`, `channel.seen`. Nothing about channels is
  drawn for an engine that reports less.
- Protocol 5 adds `their-home`, the bounded local `people` directory, selected
  mention ranges and kind-0 picture revisions; see [wishes.md](wishes.md).
- Protocol 5 adds exact cached month counts and per-window ordinals (`timeline`),
  plus month/ordinal anchors on the existing `window` input. Supported lists
  use the [time rail](time-rail.md); unsupported sources retain native scrolling.
- `hint` (visible subscriptions, page hidden, idle, network quality) and
  `configure` (engine-side settings; the interface owns their storage).

Rules:

- The engine side proposes protocol changes in `docs/engine-proposals.md`;
  `protocol.ts` changes only on the frontend side.
- The interface keeps on this device, in `localStorage` under `lkjstr:`, only
  what is its own: settings, layouts, each tab's state and reading position,
  closed tabs, the active account's pubkey and face (name, picture, kind of
  signer: public data, so a reload starts as the reader). Events, keys and
  relay state are the engine's; a typed or shown key is never stored.
  The second owner note permits bounded public row replay and media dimensions;
  engine permission fences it from private projections. See [public-view-cache.md](public-view-cache.md).
- Home draws the composer's retained draft while the signature is pending.
  The Worker supplies the signed row and its exact id for reconciliation.
  Likes and reposts are drawn at once and publish when Undo lapses or the page closes or hides.

## Commands

Run in `web/` with Node 24 and pnpm 11.

```sh
pnpm install
pnpm dev            # rebuild ../dist on change (mock engine)
pnpm serve          # serve ../dist on 127.0.0.1:8417 with the production headers
pnpm check          # the gate: repo rules, tsc, biome, vitest; prints "ok check"
pnpm build          # mock ../dist, prints "ok build"
pnpm build:real     # Rust package plus real-engine ../dist
pnpm smoke:real     # real app against loopback fixtures only
pnpm package        # pack current dist into ../tmp/lkjstr-dist.tar.gz
pnpm smoke          # mock UI, then real-engine loopback uploads; prints ok lines
pnpm shots          # screenshots to ../tmp/screens (all sizes, themes, languages)
pnpm vitest run tests/undo.test.ts   # one test file
pnpm fix            # biome --write
```

`pnpm build -- --engine=<dir>` consumes the package described in
[engine-package.md](engine-package.md). All engine imports, worker entries and
WASM assets receive hashed names in place of the mock. Startup loads the
package Transport adapter. `pnpm package` never rebuilds dist. It requires Python 3 for archive preflight:
allowed file suffixes, safe paths, at most 4096 entries, nonempty regular files,
local index references and external scripts under the edge CSP. Network-path
references are rejected for index links and all scripts, and base elements are
rejected in every HTML file. Errors name the file.

`pnpm shots` takes `--only=<width>-<theme>-<lang>` and `--scenes=home,thread`.
`LKJSTR_CHROME=<path>` picks the browser for `smoke` and `shots`.

Finish a change with `pnpm check`, `pnpm build` and `pnpm smoke`, and run
`pnpm smoke` after anything that touches the DOM, the WM or the keyboard.

## Rules `pnpm check` enforces

- Source files at most 300 lines (the protocol, string tables, fixtures and
  the smoke script are exempt as data).
- No classes, no HTML string sinks, no sockets or IndexedDB outside
  `src/engine/`.
- Both string tables have the same keys and placeholders, and the Japanese
  one contains no English sentence.

## Product boundary

web/ is the only interface. The Rust Worker lives in
crates/lkjstr-engine-worker; the root Cargo.toml is a virtual workspace.
Root pnpm build and quiet release gates build this frontend with that Worker.
workspace.md describes historical layout behavior; design.md describes web/.

## Public pages

Build-time scripts/site.ts emits seven page pairs at /en/*.html and /ja/*.html,
sitemap.txt (one absolute URL per line, including / and privacy.html), and robots.txt. Public copy lives in
the paired site-words-en.ts and site-words-ja.ts tables. Shared About, Docs prose
and shortcuts come from the app string tables and key definitions. The shared
card image is icon-512.png. No reading script or new dependency is needed.

The About page of Docs links to every public page and the static privacy policy.
The app shell supplies crawler metadata and bilingual noscript links.
Run pnpm shots -- --scenes=site-about,site-features,site-guide for dark shots at
1440 and 390 pixels in tmp/shots/site-{about,features,guide}-{1440,390}-{en,ja}.png.
