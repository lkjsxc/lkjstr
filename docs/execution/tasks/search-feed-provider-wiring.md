# Search Feed Provider Wiring

## Purpose

Preserve the Rust Search provider, snapshot-restore, and cached plus relay
older-page slice without claiming broader product parity or TypeScript deletion
readiness.

## Status

Partial. Storage-owned token rows, SQL command metadata, a worker-owned local
query adapter, app-owned submitted-query demand, a Rust Search tab shell, and a
worker-backed Rust provider for local indexed results plus bounded relay NIP-50
snapshots, cached older pages, and relay older pages exist. The shipped Svelte
Search tab remains product owner until broader parity and no-import proof exist.

## Current Evidence

- `crates/lkjstr-storage/src/search.rs` owns tokenization, token rows, and
  bounded candidate intersection with compound cursor helpers.
- `crates/lkjstr-web/src/sqlite_store/search.rs` exposes worker-owned local
  indexed query adapters with cursor-bound older-page reads.
- `crates/lkjstr-app/src/feed/tool_inputs.rs` builds selected-relay NIP-50
  demand from non-empty submitted Search text.
- `crates/lkjstr-app/src/search_feed/` keeps empty Search idle, trims submitted
  text, exposes pending/provider-gap states without fake results, and merges
  real row windows by event id and relay provenance.
- `crates/lkjstr-ui/src/workspace/search.rs` submits non-empty queries through
  cancellable provider leases, renders provider completions and older footer
  commands, and restores `filterState.searchQuery` from tab snapshots.
- `crates/lkjstr-ui/src/workspace/search_snapshot.rs` records Search
  `filterState.searchQuery` into runtime tab snapshots.
- `crates/lkjstr-web/src/search_feed_host.rs` reads the worker-owned local
  token index, renders cached rows immediately, and starts bounded relay NIP-50
  snapshots when selected read relays exist.
- `crates/lkjstr-web/src/search_feed_host_commands.rs` loads cached older pages
  and starts bounded relay older reads with compound `{createdAt,id}` cursors.
- `crates/lkjstr-web/src/search_feed_relay*.rs` plans Search relay older
  filters with exact same-second cursor rejection before merging snapshots.
- `crates/lkjstr-web/src/host_providers.rs` persists Rust tab snapshots through
  the worker-owned SQLite tab-state repository.
- `src/lib/tabs/search/SearchTab.svelte` remains the shipped Search product
  surface and handles local/relay merge while Rust parity is incomplete.

## Next Edit

Preserve this Search provider, tab snapshot, and cached plus relay older-page
proof while wiring remaining product parity. Keep deletion proof open.

## Files To Read

- [search.md](../../product/tools/search.md)
- [storage-search-index.md](storage-search-index.md)
- [../current-blockers.md](../current-blockers.md)
- `src/lib/tabs/search/SearchTab.svelte`
- `src/lib/search/search-query.ts`
- `crates/lkjstr-app/src/feed/tool_inputs.rs`
- `crates/lkjstr-web/src/sqlite_store/search.rs`

## Files To Touch

- `crates/lkjstr-app/src/search_feed/**`
- `crates/lkjstr-ui/src/workspace/search*.rs`
- `crates/lkjstr-web/tests/*search*_test.rs`
- Rust/WASM cutover ledgers and `docs/current-state.md`

## Focused Gate

```sh
/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-app --test search_feed_test --test feed_tool_input_test
/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-ui search
/home/lkjsxc/.cargo/bin/cargo check -p lkjstr-web --target wasm32-unknown-unknown
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome \
  --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-4c97d18784ddc26e/chromedriver \
  crates/lkjstr-web --test search_feed_tab_test -- --nocapture
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome \
  --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-4c97d18784ddc26e/chromedriver \
  crates/lkjstr-web --test search_feed_relay_test
pnpm test -- tests/unit/search
```

## Acceptance

- Search tabs no longer fall through to the pending placeholder body.
- Query input opens empty and does not use the active account as query text.
- Empty submissions stay idle and do not create query demand.
- Non-empty submissions trim text and expose Search NIP-50 demand on selected
  relays.
- Injected real result rows render through the shared feed row model.
- Worker-backed Rust Search provider execution reads the local token index
  without full cached-event scans.
- Local indexed rows render without waiting for remote relays.
- Bounded selected-relay NIP-50 snapshots merge with cached rows by real event
  id/provenance.
- Search restores `filterState.searchQuery` from feed tab snapshots and persists
  submitted query text to worker-owned tab-state rows.
- Cached and relay older pages load through the footer command without
  skipping same-second events across compound cursor boundaries.
- The slice does not claim broader Search parity or TypeScript deletion.

## Must Not

- Do not full-scan cached events as normal local Search behavior.
- Do not fake Search results or fake NIP-50 support.
- Do not require an active signing account.
- Do not delete `src/lib/search/**` or `src/lib/tabs/search/**`.
