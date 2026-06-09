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
- [feed-evidence.md](feed-evidence.md): feed cursors, coverage rows, scan hints,
  and ledger-backed feed evidence.
- [diagnostics.md](diagnostics.md): relay information, summaries, suggestions,
  author routes, route blocks, notifications, jobs, and app log rows.
- [retention.md](retention.md): cache ledger selection, delete dispatch, pressure,
  and optimizer command status.
- [repair.md](repair.md): conservative repair reporting, inventory exceptions,
  search/tag lookup status, and open gaps.

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

1. protected command coverage.
2. event cache command coverage.
3. feed evidence command coverage.
4. diagnostics command coverage.
5. jobs command coverage.
6. app log command coverage.
7. optimizer command coverage.
8. retention command coverage.
9. repair command coverage.
10. search/tag lookup storage command coverage.
11. pressure inventory command coverage.

## Rules

- Do not add metadata for repositories that do not exist.
- Batch writes list every resource and ledger statement executed together.
- Inventory-only commands may omit statement ids only when this matrix says so.
- Protected rows are never prunable and use `protected` protection policy.
- TypeScript repositories remain until Rust product wiring and no-import proof
  are recorded in the cutover ledgers.
