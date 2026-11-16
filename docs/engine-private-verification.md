# Private integration verification

## Purpose

Record the sixth integration's actual checks, unresolved gates and artifact
boundaries. This document is evidence for a candidate, not a deployment claim.
The worktree is `tmp/private-integration-tree` under the canonical checkout.

## Scope

Protocol 10 adds bounded private-list reads for local, extension and bunker
accounts. Query visibility and account ownership control external reads.
Private-list cancellation remains independent of Messages consent and refusal.
The integration retains protocol 9 zap evidence, unpaid invoice intents,
reading hints, private editor coordination and upload cancellation.

The same batch includes time-rail overflow measurement batching. It changes
measurement order while preserving DOM structure, row heights, string tables
and CSS. Native-scrollbar views retain their existing sequential behavior.
See [private-lists.md](private-lists.md) and
[frontend-layout.md](frontend-layout.md) for policy, limits and measurements.

## Integration corrections

The frontend checks the lifetime of a private-list request after every awaited
extension operation. A cancelled, hidden, removed, locked or expired request
cannot begin a subsequent decrypt or identity check. An already open extension
dialog cannot be dismissed programmatically. Live requests retain both signer
identity checks, and cancellation does not set the Messages refusal state.

Nine await-boundary regressions failed before the correction at 13:53:57 UTC
on 2026-11-16. All 22 adjacent frontend cases passed at 13:54:45 UTC, and the
private branch's full web check passed in 5.966 seconds at 13:55:05 UTC.
The logs are `tmp/private-list-cancel-{before,after,web-check}.log` in the
private feature worktree. The correction was integrated as commit `825bafca`.

Combining private-list completion with zap discovery exposed three failures:
a private completion invented a relay phase before any core State, replayed
old zap evidence, or reused the phase of a replaced account query.
The fourth case, reverse-order completion, was a passing control.
All three failures reproduced at 14:08:39 UTC in 9.889 seconds, with load
3.53/3.02/2.83 at start and 3.40/3.00/2.83 at finish.

Both dependency caches now retain only observed relay metadata. Every emitted
State projects current private-list and zap evidence. Query replacement clears
the previous phase, and signed-out notifications retain their core done state.
All four integration cases plus ten adjacent native cases passed, together with
the Worker WASM check, at 14:09:32 UTC in 10.463 seconds. Load changed from
2.74/2.89/2.80 to 2.62/2.86/2.79.
Evidence: `tmp/private-state-{before,after}.{log,json}`.
Source: `wire/private_lists.rs`, `wire/notification_evidence.rs`,
`wire/output_helpers.rs` and `wire/translate.rs` under the core engine.

## Completed integration checks

All times below are UTC on 2026-11-16. Commands used four Cargo jobs and four
test threads, with a serialized shared target directory. Browser/package
paths belong to the isolated worktree.

| Gate | Start | Seconds | Load before | Load after |
| --- | --- | ---: | --- | --- |
| `pnpm check:repo` | 14:14:18 | 1.089 | 2.54/2.19/2.48 | 2.54/2.19/2.48 |
| `pnpm test:quiet` | 14:14:19 | 133.520 | 2.54/2.19/2.48 | 6.15/4.55/3.37 |
| `pnpm rust-wasm:quiet` | 14:16:33 | 98.776 | 6.15/4.55/3.37 | 5.05/4.63/3.52 |

All three passed on their first attempts. Exact command, UTC, duration,
load, source head and log paths are in `tmp/sixth-gates.json`.
The only gate preparation edit was the layout document's README index entry.

The five transport suites passed 42 cases; the combined transport and full
web check took 6.893 seconds at 14:05:26 UTC. The full web check including
layout passed again at 14:08:09 UTC in 6.168 seconds.
Logs: `tmp/private-integrated-source-check.log` and
`tmp/private-integrated-layout-check.log`.

## Artifact and rebase boundary

The three-gate checkpoint was `f3abfdf9`, with production WASM SHA-256
`8542169dcf88aa406f1dc8b63408394704efbfab39041c77b19a00cce5e502e4`
and size 7,904,765 bytes. It is recorded in `tmp/sixth-package.json`.

The branch was then rebased onto upstream `a6669a1a`, which includes the
startup packaging correction. All Rust, Cargo and toolchain files remained
identical to the three-gate checkpoint. The gate-produced package predates
that packaging rebase and is not evidence for rebuilt current assets.
The only conflict was the conformance script: all three host-observer suites,
all five transport suites and the private fixture step were retained.
Details: `tmp/private-integration-rebase.json`.

The earlier isolated private-list Worker suite passed 30/30 at 13:33:09 UTC,
using WASM `9527440bed31934fea58922b70549dacbc7f6290ec562082e22f907c4acd1940`.
That result supports the feature branch; it is not a merged protocol-10 run.

## Remaining gates

The following remain pending after the final fifth-landing rebase:

- Narrow xtask tests for the corrected packaged-resource validation.
- Required `pnpm verify:quiet`.
- Web `pnpm check`, `pnpm build` and the complete default `pnpm smoke`.
- Main `scripts/engine-check.sh`, including the private-list suite and
  protocol-derived output/coverage checks.

The driver records each attempt independently and stops on failure. A repeated
attempt retains the previous log and report evidence. It uses fresh loopback
origins and browser data, and creates no public relay publication or payment.
No complete merged release gate, production deployment or public-hour result
is claimed while these entries remain pending.

The required public hour after the sixth landing must use the actual merged
release bytes. Earlier hours and synthetic layout replays do not substitute
for that follow-up.
