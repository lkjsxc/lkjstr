# Worker-owned WASM startup

## Purpose

Record the real-build startup regression found before the protocol-9 landing,
and the packaging correction that preserves the engine and offline shell.
These are finite loopback browser results, not public-network measurements.

## Reproduction and scope

The ordinary web smoke starts three fresh browser contexts for local, extension
and bunker upload flows. Each waits at most 30 seconds for the first Global
note before exercising any signer. The candidate failed at that initial
boundary: SharedWorkers never emitted ready and no relay request was made.

A single-context reproduction succeeded. With three contexts, Runtime
exceptions recorded `WebAssembly compilation aborted` and a network error
saying the response body load was aborted. The Worker stayed in its initial
connect queue before its engine handle existed. CSP/eval errors and protocol
mismatch were not observed.

The frozen candidate WASM was
`8fae169150b8ab8c07258292de61a41bec61610407a8a46d430d2561dd0c4016`.
It is distinct from the shipped third build, whose WASM was
`16f5e1eaac905008c0cb89d059ce092c073f7bac437e7bbc67588a57709bd336`.
The shipped build passed the same single finite three-context comparison; this
evidence does not establish a failure in the live 541e4a1e deployment.

## Controlled changes, 2026-11-16 UTC

All tests used the original wait bound and strict production-style CSP. Load
columns are start-of-run 1/5/15-minute host averages. Total test duration is not
a per-page startup latency. All owned contexts, browsers and servers closed.

| Variant | UTC start | Load | Result |
| --- | --- | --- | --- |
| Original candidate | 14:11:28 | 1.11/2.27/2.58 | 0/3 notes; three aborted WASM body exceptions |
| Original, service workers blocked | 14:14:15 | 2.54/2.19/2.48 | 1/3 notes; two aborted WASM bodies |
| Remove only page WASM preload, regenerate valid shell | 14:17:24 | 4.29/4.31/3.35 | 3/3 notes; all shells activated; 1.915 s |
| Original, owned HTTP requests bypass explicit route continuation | 14:17:26 | 5.14/4.49/3.41 | 0/3 notes; three aborted WASM bodies |
| Frozen shipped third build | 14:19:37 | 3.03/4.03/3.40 | 3/3 notes; no Worker exception; 1.892 s |
| Fresh build after source correction | 14:20:38 | 3.79/4.03/3.44 | 3/3 notes; all shells activated; 1.907 s |

The first diagnostic preload removal intentionally changed the copied index
without updating the shell digest. Notes appeared but the shell correctly
rejected installation. That attempt is retained separately and does not count
as an offline-shell pass. The valid-shell and source-built cases above include
the regenerated hash manifest and successful activation.

## Correction and lasting regression

build.ts no longer adds a document-level fetch preload for the Worker-owned
WASM resource. Module preloads remain; the Worker still performs its actual
WASM fetch and instantiation. The CSP, body verification, shell digest checks,
activation behavior, engine code and visible interface are unchanged.

The after build retains all five hashed engine/Worker/WASM assets byte for
byte. Its HTML and shell manifest change together. The existing three-context
real upload smoke now records an explicit first-note assertion for each signer
context, before any signer-specific operation. Its original startup wait and
failure behavior remain intact.

The exact browser/fixture evidence, immutable copies and hash comparison are
under `tmp/startup-debug/` in the integration worktree. `summary.json` indexes
the meaningful variants; `run4/report.json` preserves the captured exceptions
and `run10-source-after/report.json` the fresh source-built correction.
This establishes the scoped preload correction on the tested Chromium build;
it does not establish every browser, network or future Worker startup outcome.

## Distribution graph check

The old distribution checker required WASM directly in index.html. That
assumption rejected the corrected product after its native and build gates
had passed. The check now follows recognized generated import and URL forms
from HTML through the app, adapter, Workers and loader. Every reached file
must exist and be nonempty; reached WASM must carry its header. Orphan files,
comments and unrelated strings do not establish a reachable engine.

Canonicalized paths and symlinks stay inside dist; cycles are visited once
and the graph caps at 1024 assets. This recognizes the generated graph forms,
not arbitrary JavaScript execution. Public page, canonical URL and static
asset checks remain. Ten native cases pass after the change; valid indirect
graphs failed and a missing transitive Worker passed before it.

Strict xtask clippy and the actual corrected distribution check passed at
14:49:18 UTC, load 1.01/1.46/1.94. The distribution check took 0.403 seconds;
no production asset was rebuilt or changed by this correction.
Evidence: `tmp/dist-check-proof/`. Full integration gate results are recorded
separately in [engine-zap-verification.md](engine-zap-verification.md).

## Exact archive validation

The earlier Rust distribution correction left two separate package checks
requiring a direct HTML WASM preload. The sixth prescribed ship stopped at
16:35:57 UTC on 2026-11-16 during packaging, after its real interface checks;
that attempt performed no deployment. The copied 37b14ab5 real distribution
reproduced both refusals without changing any of its 34 files.

The package command now relies on its exact tar preflight. That preflight
follows the same constrained generated import, Worker and URL token forms as
the Rust check, skips comments/text/regex decoys and visits at most 1024 assets.
All reachable dependencies must exist; every reachable WASM has its header.
Archive size/count, paths, suffixes, duplicate/empty entries, link rejection,
all HTML references, base elements and inline-script/event checks remain.
No archive data is extracted or evaluated.

At 16:54:41 UTC, all 72 package cases passed in 3.670 seconds, starting load
1.46/1.66/1.90. The initial 29 graph cases had 23 failed assertions and six
passing controls on the unchanged validator. Final review added a regression
for preserving header checks on non-executable HTML references; it failed on
the first correction and now passes. Full web check passed at 16:54:51 UTC
in 6.628 seconds, starting load 1.74/1.72/1.92. Seven mutations of the copied
real archive also rejected missing Worker/loader files, invalid WASM/UTF-8,
orphan/decoy WASM and an escaping dependency path.

The accepted 8,550,400-byte raw tar is byte-identical to the rejected before
fixture. Its SHA-256 is
`377158e749fe28ab617609424c57a3dd9d1f412a1996553589da5f528a9d2abb`.
The resulting 1,539,503-byte gzip SHA-256 is
`9c84b2cec98fc755398c0d5bc3fde6b22abd16ed51d6f355d91eaf49946a8206`.
Evidence is `tmp/package-proof/` in the isolated package-fix worktree.
This proof rebuilt no product assets and ran no Cargo, browser or deployment.
The corrected prescribed ship remains a separate required outcome.


A subsequent review found a shared lexer bypass: after a numeric literal, a
division slash was mistaken for a regex and could hide a missing import even
when valid WASM was already reachable. Both the Python archive lexer and Rust
distribution lexer now consume numeric literals as expression-ending tokens.
This is limited token recognition, not a general JavaScript parser.

At 17:06:09 UTC the Python numeric fixtures produced five failures and three
passing controls on the old lexer. All 80 package cases passed after the fix
at 17:06:55 UTC in 3.620 seconds, load 1.22/1.15/1.49. The native regression
failed on freshly compiled old Rust at 17:11:15 UTC; the candidate passed all
19 xtask tests in 2.217 seconds, load 4.98/2.58/1.95. Strict Clippy passed.
Both builds refreshed and recorded owned source mtimes/hashes, and restored
the candidate after the before proof. Evidence: `tmp/numeric-proof/` in the
release-fix worktree. The combined required gates and exact packaging now
pass; [engine-history-route.md](engine-history-route.md) records dates, loads
and final artifact hashes. The prescribed ship result is recorded below.

## Prescribed ship reached host failure

The clean rebased `ce05e29244f76de725b78fc71c41fbfd1f14ba8f` was pushed to
main. Its prescribed ship ran on 2026-11-16 from 17:44:14 to 17:53:27 UTC,
starting at load 3.20/3.50/3.63. Web check, all 548 real interface checks
with zero page errors, the final real build and exact archive check passed.
The production WASM remained the verified `c7c7a7dd...` artifact above.

The submitted 1,539,617-byte gzip SHA-256 was
`c5380f86904ddbf27e4017d139395fe0169e6be809dc2e2cf4785ae0cbc35b87`;
its index SHA-256 was
`075e2b7c57b33ac3c8134753821ded92f93c443e16f1ba0924788a97a4d9da87`.
Package transfer completed, but the prescribed host operation reported failure.
There is no successful deployment receipt or served-index verification for this
attempt. The last confirmed successful ship remains `541e4a1e`.

An ordinary HTTPS read from the workspace timed out after 20 seconds. A
separate read using the exact origin route from the prescribed script could
not connect within five seconds. Neither result establishes site state from
this workspace. The owner handoff forbids other commands on that host; no
extra SSH diagnosis was run. A read-only diagnostic request is on Desk, while
engine work continues. Exact logs, tar, UI report, checksums and empty owned
process inventory are in `tmp/seventh-ship-attempt1/` in the canonical worktree.
