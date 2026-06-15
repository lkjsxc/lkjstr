# Thread Feed Provider Wiring

## Purpose

Preserve the first Rust Thread host-provider slice without claiming Thread
relay-read parity or TypeScript deletion readiness.

## Status

Partial. Rust has a Thread feed view model, Leptos Thread body, cache-backed
host provider for root/reply rows already present in worker-owned SQLite, and a
bounded bootstrap relay read target. The explicit footer command can start the
next older relay page from retained Thread relay state, and a downward near-end
scroll gesture or underfilled viewport can request the same older path. Initial
completion starts a bounded live reply window from the newest retained row.
Focused-reference hydration reads cached rows tagged to the focused event and
uses root plus focused `#e` relay targets. Bounded cached parent-chain
hydration reads exact parent ids from worker-owned SQLite and bootstrap relay
plans request parent ids already visible from cached Thread rows. Terminal
unavailable-parent rows render after exact cache and complete relay lookup, and
capped deep branches render continuation rows that open matching Thread tabs.
Deletion proof and broader Thread parity remain open.

## Current Evidence

- `crates/lkjstr-app/src/thread_feed/**` builds Thread root lookup and reply
  query inputs, explicit missing-event/no-relay states, partial source states,
  pending loading state, and shared feed rows.
- `crates/lkjstr-ui/src/workspace/thread.rs` renders Thread rows from
  `ThreadFeedView`; `thread_continuation.rs` opens matching Thread tabs for
  collapsed branches only when a real thread callback exists, otherwise
  continuation rows stay static, and `thread_provider.rs` suppresses late
  completions after tab cleanup.
- `crates/lkjstr-web/src/thread_feed_cache.rs` reads cached focused/root events
  plus cached replies by `#e` root and focused-event tags from the SQLite worker
  and exact cached parent-chain rows by id. The cached-only result stays partial
  while bootstrap relay reads start.
- `crates/lkjstr-web/src/thread_feed_host.rs` wires the provider into the
  default Rust host provider set with selected read relays.
- `crates/lkjstr-web/src/thread_feed_relay*.rs` starts bounded bootstrap relay
  reads, starts a bounded live reply read after bootstrap completion, merges
  progressive snapshots into cached rows, targets root plus focused `#e`
  references, requests exact cached parent ids during bootstrap, and cancels
  reads on owner cleanup.
- `crates/lkjstr-web/src/thread_feed_unavailable_parents.rs` derives terminal
  unavailable parent ids only after initial exact lookup completes.
- `crates/lkjstr-app/src/thread_feed/paging.rs`,
  `crates/lkjstr-ui/src/workspace/thread_older.rs`, and
  `crates/lkjstr-web/src/thread_feed_host_commands.rs` plan and trigger the
  explicit older relay page without claiming live Thread parity.
- `crates/lkjstr-ui/src/workspace/thread_scroll.rs` gates downward near-end
  Thread scroll gestures and underfilled viewport probes before forwarding an
  older request.
- `crates/lkjstr-ui/src/workspace/thread_provider.rs` exposes Thread older
  loading only for providers built with a real older handler; injected read-only
  providers do not render older controls or dispatch no-op older requests.
- `crates/lkjstr-ui/tests/thread_provider_test.rs` proves released initial and
  older Thread provider requests suppress late completions.

## Next Edit

Preserve unavailable-parent and continuation-row proof. Continue with
remaining Profile actions and deletion proof.

## Files To Read

- [current-blockers.md](../current-blockers.md)
- [../../architecture/runtimes/thread-runtime.md](../../architecture/runtimes/thread-runtime.md)
- [../../architecture/rust-wasm/cutover/feed-runtime.md](../../architecture/rust-wasm/cutover/feed-runtime.md)
- [../../architecture/rust-wasm/cutover/implementation-ledger.md](../../architecture/rust-wasm/cutover/implementation-ledger.md)
- [../../product/feeds/threads.md](../../product/feeds/threads.md)

## Files To Touch

- `crates/lkjstr-app/src/thread_feed/**`
- `crates/lkjstr-ui/src/workspace/thread*.rs`
- `crates/lkjstr-web/src/thread_feed_*.rs`
- `crates/lkjstr-app/tests/thread_feed_test.rs`
- `crates/lkjstr-web/tests/thread_feed_provider_test.rs`
- Rust/WASM cutover ledgers and `docs/current-state.md`

## Focused Gate

- App Thread gate:

```sh
/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-app \
  --test thread_input_test --test thread_feed_test \
  --test thread_feed_paging_test --test thread_context_rows_test
```

- `/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-ui thread`
- `/home/lkjsxc/.cargo/bin/cargo check -p lkjstr-web --target wasm32-unknown-unknown`
- Browser unit relay helper filter:

```sh
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome \
  --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-4c97d18784ddc26e/chromedriver \
  crates/lkjstr-web -- thread_feed_relay
```

- Pinned Chrome command:

```sh
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome \
  --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-4c97d18784ddc26e/chromedriver \
  crates/lkjstr-web --test thread_feed_provider_test -- --nocapture
```

- Pinned Chrome Thread scroll command:

```sh
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome \
  --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-4c97d18784ddc26e/chromedriver \
  crates/lkjstr-web --test thread_feed_scroll_older_test -- --nocapture
```

- Pinned Chrome Thread viewport-fill command:

```sh
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome \
  --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-4c97d18784ddc26e/chromedriver \
  crates/lkjstr-web --test thread_feed_viewport_fill_older_test -- --nocapture
```

## Acceptance

- Thread tabs no longer fall through to the pending placeholder body.
- Cached root, reply, focused-reference, and parent-chain events render from real
  worker-owned SQLite rows.
- Bootstrap relay root/reply snapshots merge into cached Thread rows.
- Bootstrap, live, and older reply relay filters target the root and focused
  event `#e` values.
- Bootstrap relay exact-id filters include parent ids visible in cached Thread
  rows.
- Terminal parent misses render retryable unavailable-parent rows only after
  exact cache and complete relay lookup.
- Capped deep reply branches render continuation rows that open configured
  Thread tabs for the hidden target event only when the callback exists; missing
  callbacks render static continuation rows.
- The explicit older footer command starts a bounded `#e` page read before the
  current oldest Thread row only when the provider exposes a real older handler.
- Released Thread older-provider leases suppress late completions.
- Downward near-end Thread scroll requests an older load only from a scrollable
  owner.
- Underfilled Thread viewport measurement requests an older load without user
  scroll and does not repeat for the same rendered row count.
- Bootstrap completion starts a bounded live reply read from the newest retained
  Thread row using the root and focused `#e` filter.
- Owner cleanup cancels the in-flight Thread relay read.
- Missing event id and missing selected relay states are explicit data rows.
- Pending Thread provider work renders explicit loading, not ready.
- Thread output remains partial until broader Thread parity and deletion proof
  are complete.
- Ledgers name the remaining broader parity and deletion gaps.

## Must Not

- Do not create fake Thread rows or placeholder success.
- Do not mark Thread implemented from cached rows alone.
- Do not delete `src/lib/thread` or Svelte tab glue without exact-read parity
  and no-import proof.
- Do not open SQLite or OPFS directly from product/UI code.
