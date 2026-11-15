# Protocol 3

## Purpose

Real-engine implementation of the merged frontend feedback contract. The
frontend-owned protocol.ts and visible interface wording remain unchanged.

## Served behavior

- ready advertises 3, enabling people filters, mixed notifications and kinds.
- Text words all match case-insensitively. Phrases preserve spaces; exclusions
  reject any matching substring. Every requested image/video/link is required.
  Link predicates use rendered segments, so an image alone is not also a link.
- from decodes npub/nprofile and resolves retained profile names (exact first).
  NIP-05 query names use bounded HTTP evidence validation and trigger replanning.
  Resolved keys form a union with authors; unresolved names match nothing.
  Name bindings cap at 512; existing HTTP retries/concurrency limits apply.
- Date bounds are milliseconds and inclusive. Lower bounds round up to seconds,
  upper bounds round down. Relay history retains those bounds while paging.
  Search can use phrases, authors or media without text. Relay text search uses
  the first word as a superset; every word is checked locally.
- Home/Global mix the same grouped notification rows and keys as Notifications,
  ordered by notification time and omitting notes already present. Closing and
  reopening without notifications removes them. Held anchors retain position.
- Profile headers precede posts, replies, kind 6/16 repost targets, kind 7 reaction
  targets or image/video notes. Action views order by action time and deduplicate
  target keys. Missing targets are fetched; unavailable targets are omitted.
  Empty exhausted profile kinds report done with atBottom.
- Window requests accept before/after up to 800; retainAbove keeps its existing
  6000 bound. Projected headers cannot cause false end-of-list claims.
- Existing signer-driven NIP-65 discovery adopts owner read/write routes and
  lists owner relays first. Bootstrap hints remain discovery routes.
- Existing owner blocks keep client tags enabled by default, list-aware Blossom
  defaults with NIP-96 fallback, measured stats and cache-only rowAtTime.

## Additive orchestration observations

Stats adds optional publication counters per relay and recentPublications with
up to 32 plans, destination rules/states/cap reasons and unresolved recipient
counts. Existing delivery messages continue after the first successful result.
No timeline ordering or capability gate changes. The exact semantics and
unimplemented planner portions are in [orchestration.md](orchestration.md).

## Verification

The web check, mock build/smoke, repository check and all quiet Rust/release gates
pass. Real smoke passes 73/73 checks, including all 39 signer checks, with zero
page errors. Eight new native regressions cover rich filtering, profile kinds,
large windows, NIP-05, mixed history, deferred reposts and grouped fresh counts.
Worker conformance passes 164/164 checks with zero page errors; its delayed
profile probe passes too. All browser fixtures use loopback or intercepted HTTP.

Reports and bounded logs are under ignored tmp/: protocol3-*.log,
engine-harness/report.json and smoke-real/report.json. Smoke changes correct
account-menu selection, relay search expectations, bootstrap discovery sockets
and non-HTTP setup guards. No visible product strings or layout changed.

Docker is excluded because its storage writes fall outside the worktree. No
public-relay publication, CI edits, commits, deployments or existing-service
changes were performed.

## Changed files

- Engine policy: engine/protocol.rs, rich.rs, query.rs, query_predicates.rs,
  history.rs, wants.rs, windows.rs, identities.rs, input.rs and mod.rs under
  crates/lkjstr-core/src/. The prefetch.rs bound comment is corrected too.
- Wire adapter: queries.rs, query_translate.rs, translate.rs, sources.rs,
  output.rs and mod.rs under crates/lkjstr-core/src/engine/wire/.
- Name evidence: crates/lkjstr-core/src/store/identity.rs and mod.rs.
- Native cases: crates/lkjstr-core/tests/engine_rich_test.rs and
  engine_rich_history_test.rs.
- Worker cases: scripts/engine-rich.mjs, engine-feedback.mjs and
  engine-harness.mjs.
- Browser cases: web/scripts/smoke-real.mjs, smoke-seed.mjs,
  smoke-signer-support.mjs and smoke-visitors.mjs.
- Documentation: docs/README.md, architecture.md, status.md, verification.md,
  integration-release.md and this file.
