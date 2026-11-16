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
