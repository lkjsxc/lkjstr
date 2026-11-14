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

Today the worker is the mock engine (`src/engine/mock/`), which is also the
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
| `src/static/privacy.html` | The static privacy policy page |
| `scripts/` | `build.ts`, `serve.ts`, `check.ts`, `smoke.ts`, `shots.ts` |
| `tests/` | vitest: layout, words, keys, formats, undo, the mock engine |

Seams worth knowing inside `src/views/`:

- `feed.ts` is every list of rows (home, global, hashtag, search, bookmarks,
  thread, profile, people, notifications). It decides which window of rows to
  ask for. `feed-draw.ts` turns rows into nodes, `feed-place.ts` keeps the
  reading position as an anchor row plus offset, `feed-keys.ts` is the
  keyboard, `feed-bar.ts` and `filter-bar.ts` are the filter.
- `note.ts` draws a note, `note-actions.ts` its action row and menus,
  `held.ts` holds a like or repost back until its Undo has lapsed.
- `wm/controller.ts` owns one workspace; `wm/closed.ts` is its stored list of
  closed tabs, `wm/choices.ts` what the New tab page offers.

## The engine boundary

`protocol.ts` is plain structured-clone messages:

- `open {sub, query}`, `window {sub, anchor, before, after}`, `close {sub}`
  from the interface; `rows`, batched `patch`, `fresh` and `state` back. A row
  is a finished view model; the interface virtualises and never reorders.
- `act {req, action}` with a `result`, plus `progress` and per-relay
  `delivery` for publishes and uploads.
- `sign` from the engine when the account uses a browser extension, answered
  with `signed` (NIP-07 exists only on the main thread).
- `hint` (visible subscriptions, page hidden, idle, network quality) and
  `configure` (engine-side settings; the interface owns their storage).

Rules:

- The engine side proposes protocol changes in `docs/engine-proposals.md`;
  `protocol.ts` changes only on the frontend side.
- The interface keeps on this device, in `localStorage` under `lkjstr:`, only
  what is its own: settings, layouts, each tab's state and reading position,
  closed tabs, the active account's pubkey. Events, keys and relay state are
  the engine's.
- One deliberate piece of optimism lives in the interface: a like or repost
  is drawn at once and published only after its Undo lapses (or when the page
  is hidden or closed). Everything else is drawn from engine patches.

## Commands

Run in `web/` with Node 24 and pnpm 11.

```sh
pnpm install
pnpm dev            # rebuild ../dist on change (mock engine)
pnpm serve          # serve ../dist on 127.0.0.1:8417 with the production headers
pnpm check          # the gate: repo rules, tsc, biome, vitest; prints "ok check"
pnpm build          # ../dist, prints "ok build"
pnpm smoke          # build, then drive Chromium against the mock; prints "ok smoke"
pnpm shots          # screenshots to ../tmp/screens (all sizes, themes, languages)
pnpm vitest run tests/undo.test.ts   # one test file
pnpm fix            # biome --write
```

`pnpm build -- --engine=<dir>` publishes `<dir>/engine.js` (a module worker)
and its `.wasm` under hashed names in place of the mock.

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

## The old interface

`crates/lkjstr-web` (Leptos, built by Trunk from the root `index.html`) is
the interface this one replaces. It stays in the tree because the engine
branch still builds from it. Do not extend it, and do not take its documents
([workspace.md](workspace.md), the UI part of
[architecture.md](architecture.md)) as describing `web/`.
