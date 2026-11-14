# Architecture

## Purpose

How lkjstr is put together, for anyone changing it.

## Crates

| Crate | Role | Browser APIs |
| --- | --- | --- |
| `lkjstr-protocol` | Nostr kernel: events, signing, NIP-19, filters, messages | none |
| `lkjstr-core` | Layout, workspace, store, planner, scoring, timelines, content | none |
| `lkjstr-web` (root package) | Leptos UI, runtime, host adapters | yes |
| `lkjstr-xtask` | Repository checks and quiet gates | none |
| `lkjstr-host` | Native static server (not yet adapted to Trunk output) | none |

`lkjstr-core` is where decisions live; it has native tests. `lkjstr-web` holds
effects only: sockets, IndexedDB, timers, NIP-07 and rendering. JavaScript is
limited to what Trunk and wasm-bindgen generate to load the module.

## Data flow

1. A visible tile registers a `Want` (`plan::Want`) through `App::want`.
2. Wants change, so the runtime schedules a replan (30 ms debounce).
3. `plan::plan` turns all wants into `Planned` requests: one REQ per relay and
   group, authors routed by their NIP-65 write relays (outbox) with scored
   defaults as fallback, profiles and event lookups batched.
4. `runtime/net.rs` diffs the plan by request key: CLOSE what vanished, queue
   what is new, send up to 10 per relay, mark one-shots done at EOSE.
5. Socket messages land in `runtime/relay_msg.rs`. Events go to a queue that
   `runtime/ingest.rs` drains in 8 ms slices: dedupe, verify, insert.
6. The store bumps its revision; the UI's `rev` signal fires at most every
   120 ms and views re-query the store.
7. New and replaced events are written to IndexedDB every 1.5 s.

## Storage

One IndexedDB database `lkjstr` with two stores:

- `events`: `{id, created_at, raw}` rows, index on `created_at`. The newest
  8000 load at startup; the in-memory store keeps at most 20000.
- `kv`: `workspace`, `settings`, `session`, `scores`, `draft:*`, and
  `secret:<pubkey>` for local keys. Secrets leave storage only through the
  explicit "Back up key" action.

## Runtime handle

`runtime::App` is `Copy`: a `StoredValue` around `Rc<RefCell<Rt>>` plus three
signals (`rev`, `net_rev`, `session_rev`). Rule: never call `App::with` inside
`App::update`, and set signals after the borrow ends.

## UI

`ui/shell.rs` boots, provides `Ui` (runtime, workspace signal, settings,
narrow flag, help flag, page visibility) and handles global keys.
`ui/tiles.rs` renders the layout tree keyed by node id so tab bodies survive
unrelated edits. `ui/pane.rs` draws strips and keeps inactive bodies mounted
but hidden (scroll survives), passing `visible` so their wants are released.
