# Zap integration and runtime evidence

## Purpose

Record the fifth engine landing's integration gates, failures and scoped
regressions on 2026-11-16. This record distinguishes the production package,
the instrumented loopback harness and public-network measurements.
All seven required gates passed after the startup and distribution-check
corrections. The final verify also reran the native and real-build checks.

## Changes and evidence boundaries

Protocol 9 adds provider-authorized receipt totals, notification actors,
finite quote/receipt requests and explicit unpaid invoice preparation.
The engine validates provider authority and exact invoice commitments; it
never calls a wallet or treats an invoice as paid. Existing counters and
reading controls are wired without new words, CSS or layout.
[Zap behavior and limits](zaps.md) describe the contract and bounds.

Three integration findings have separate reproductions:

- Signed-out notification snapshots must preserve the core done phase.
  Provider-evidence updates retain observed relay phases and counters.
- Large retained views must not starve the current reading target; bounded
  target indexes remove repeated full-store scans.
- Parallel fresh contexts reproduced aborted WASM response bodies with a
  document-level preload. Worker-owned loading passed the controlled
  comparison without changing engine bytes or weakening shell verification.

The first two have native failures on the preceding implementation. The
third uses the existing parallel browser startup gate plus captured Worker
exceptions. [Projection proofs](engine-performance-zaps.md) and
[startup evidence](engine-startup.md) preserve dates, load and limits.

## Required gates

All durations include each command's setup/build work. Load is the shared
host's 1/5/15-minute average at command start and finish. Cargo and native
tests use at most four jobs/threads and worktree-local caches.
The final verify passed after the distribution-check correction. Earlier
successful gates are retained below with their exact source boundary.

| Command | UTC start | Seconds | Start load | End load | Outcome |
| --- | --- | --- | --- | --- | --- |
| pnpm test:quiet | 13:46:17 | 99.778 | 1.12/2.40/2.45 | 7.44/5.41/3.61 | pass |
| pnpm check:repo | 13:48:33 | 0.639 | 4.75/4.95/3.52 | 4.75/4.95/3.52 | pass before final docs |
| pnpm rust-wasm:quiet | 13:48:34 | 97.254 | 4.75/4.95/3.52 | 3.11/4.30/3.43 | pass before preload removal |
| pnpm verify:quiet | 13:50:59 | 75.183 | 2.06/3.85/3.32 | 1.77/3.37/3.19 | pass before preload removal |
| web pnpm smoke | 14:21:42 | 410.577 | 2.77/3.67/3.35 | 2.69/2.70/2.98 | pass after preload removal |
| web pnpm check | 14:28:49 | 5.862 | 2.09/2.57/2.93 | 2.71/2.68/2.96 | pass |
| web pnpm build | 14:28:55 | 0.297 | 2.71/2.68/2.96 | 2.71/2.68/2.96 | pass |
| pnpm verify:quiet | 14:51:06 | 75.662 | 0.85/1.29/1.82 | 1.67/1.40/1.81 | pass after both corrections |
| pnpm check:repo | 14:54:33 | 0.641 | 1.40/1.36/1.74 | 1.40/1.36/1.74 | pass with completed documentation |

The successful smoke includes the mock interface, three parallel real
first-note assertions, 131 upload checks and the offline-shell integrity,
rollback, waiting-client, abandoned-stage, fallback and interrupted-
activation cases. All owned browsers, servers and temporary profiles closed.
No new designed surface was introduced by these changes.

## Worker and transport conformance

The full engine-check command passed at 14:01:16 UTC in 251.836 seconds,
with load 1.33/1.84/2.47 to 2.53/2.62/2.69. It passed 451 main Worker checks,
72 stop checks, 22 signer-deadline checks, 39 transport cases and 20 observer
and ownership cases, with no main-harness page errors.
The existing delayed-profile check also passed.

The finite production zap fixture passed 40/40 at 13:23:53 UTC in 64.148
seconds, including an actual 60018 ms signer timeout. It exercises local,
extension and bunker signing, trusted counts/actors, exact commitments,
refusal, cancellation and lock revocation. Fixtures use owned loopback
relays and intercepted HTTPS providers, not real payments or public relay
publication. It does not establish public provider interoperability.

The production package after integration has WASM SHA-256
`8fae169150b8ab8c07258292de61a41bec61610407a8a46d430d2561dd0c4016`
and 7610992 bytes. The conformance package enables harness exports and has
SHA-256 `353bf34b975f687671bd3e266a13aa422fc88a63632cd9fc7e60b80e7a591f8f`;
that run used the ordinary clock. These artifacts are not interchangeable.

## Preserved failed attempts

The first full native run exposed the notification-phase regression and
failed in 66.574 seconds. The old and two additional assertions failed
before the correction; nine focused cases and the later full gate passed.
The first smoke attempt lacked the required explicit wasm-bindgen path;
the next reached the actual parallel-startup regression. Both logs remain.

After the startup correction, a documentation vocabulary check failed
before executing the build; the prose was corrected. The next verify
completed its native/build phases but rejected a distribution whose index
did not directly name WASM. That old requirement assumed the removed
preload. The corrected check validates the reachable generated
module/Worker/loader graph and its actual WASM header; an unrelated WASM
file is insufficient. Ten native graph cases, strict xtask clippy and the
actual distribution check passed before the final full verify. These
failures are retained rather than relabeled as successful gates.

## Public measurement and remaining limits

The completed third-landing public hour belongs to frozen shipped 541e4a1e,
not this candidate. Its 12.358-second maximum scroll step and one late Home
candidate motivated separate layout and measurement work. Whole-hour
completeness remains unknown because of capped query evidence and the
subsequently reproduced startup-guard race.
[The third hour](engine-performance-third.md) records that scope.

The new measurement bootstrap gates original Worker execution until the
host has installed its read-only guard and network observation. Original
release assets remain unchanged. Bounded receipt metadata excludes event
bodies; dropped/unattributed evidence and counter resets stay unknown.
The finite positive and withheld-release proofs are recorded in
[measurement evidence](engine-performance-evidence.md). They do not replace
the next required public hour after the sixth landing.

Raw gate attempts and load samples are preserved in
`tmp/fifth-gates-20261116.json` and `tmp/fifth-gate-*.log` in the integration
worktree. No owner account, secret key, payment or public publication was used.
