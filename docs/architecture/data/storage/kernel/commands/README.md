# Storage Command Matrix

## Purpose

This directory maps live SQLite worker repository calls to Rust storage command
metadata. The matrix is executable contract material for agents adding command
specs, worker adapters, retention, repair, inventory, or Stats rows.

## Table of Contents

- [protected.md](protected.md): settings, workspace, tab, account, secret,
  relay-set, Tweet draft, active selector, and protected route-block rows.
- [event-cache.md](event-cache.md): cached events, event tags, relay provenance,
  notifications, and cache ledger writes for events.
- [search.md](search.md): indexed local Search token rows and tag lookup
  commands.
- [feed-evidence.md](feed-evidence.md): feed cursors, coverage rows, scan hints,
  and ledger-backed feed evidence.
- [diagnostics.md](diagnostics.md): relay information, summaries, suggestions,
  author routes, route blocks, notifications, jobs, and app log rows.
- [retention.md](retention.md): cache ledger selection, delete dispatch, pressure,
  and optimizer command status.
- [repair.md](repair.md): conservative repair reporting, inventory exceptions,
  search/tag lookup status, and open gaps.

## Agent Start

- Current source owner: `crates/lkjstr-storage/src/commands/**` for metadata
  and TypeScript repositories for shipped storage product calls.
- Desired Rust owner: `lkjstr-storage` command specs plus `lkjstr-web` typed
  adapters that execute those specs through worker messages.
- Next source edit: keep repair physical probes and pressure inventory inside
  storage-owned command metadata without changing retention policy.
- Focused tests: `cargo test -p lkjstr-storage commands`,
  `cargo test -p lkjstr-web retention`, and storage manifest doc checks.
- Ledgers: update storage cutover and verification ledgers after proof only.
- Keep: TypeScript storage repositories and Svelte product surfaces until Rust
  product wiring and no-import proof are recorded.

## Row Fields

Every implemented command row records command id, family, operation, input type,
output type, statement ids, tables, row codecs, problem kinds, data classes,
ledger policy, protection policy, Stats projection, worker adapter, TypeScript
repository retained, focused tests, and deletion condition.

## Status Values

- `implemented`: Rust command metadata exists and names the live worker call.
- `partial`: Rust row or worker pieces exist, but command coverage or product
  wiring is incomplete.
- `not implemented`: no Rust command metadata exists for that row.
- `out of scope`: the row is intentionally not a storage command.
- `open question`: the command boundary needs a follow-up decision.

## Implementation Order

Implemented command metadata already covers active selector, pressure,
protected rows, event cache, feed evidence, diagnostics, notifications, jobs,
app log, inventory snapshot, and optimizer scan-model rows.

1. retention worker dispatch coverage.
2. repair command coverage.
3. repair physical target probes.
4. pressure inventory completion.
5. relay effect wiring.
6. shared feed runtime.
7. Home feed slice.

## Open Command Route

| Command id | Rust metadata | SQL or table route | Worker adapter | TypeScript retained | Focused test |
| --- | --- | --- | --- | --- | --- |
| `retention.delete-dispatch` | `commands/retention.rs` | table statements in [retention.md](retention.md) | `sqlite_store/retention.rs` | cache ledger and compaction repositories | `cargo test -p lkjstr-web retention` |
| `repair.scan-ledger`, `repair.probe-targets`, and repair writes | `commands/repair.rs` | cache ledger chunks plus approved manifest target probes | `sqlite_store/repair.rs` | cache maintenance repositories | `cargo test -p lkjstr-storage repair` |
| `search.local-query` and `search.update-event-index` | `commands/search.rs` | token rows plus event tag lookups | event put token batch bridge and local indexed query adapter | search-index repositories | `cargo test -p lkjstr-storage search` |
| `storage-inventory.snapshot` gaps | `commands/inventory.rs` | generated table counts and browser inventory | `sqlite_store/inventory.rs` | Stats/cache repositories | `cargo test -p lkjstr-storage stats` |

## Rules

- Do not add metadata for repositories that do not exist.
- Batch writes list every resource and ledger statement executed together.
- Inventory-only commands may omit statement ids only when this matrix says so.
- Protected rows are never prunable and use `protected` protection policy.
- TypeScript repositories remain until Rust product wiring and no-import proof
  are recorded in the cutover ledgers.
