# Private signer lifetimes

## Purpose

Document the bounded engine decisions behind private-message signer
requests, cancellation, refusal and explicit retry.

## Core decisions

`dm::signers::Gate` owns at most 32 available account entries, eight external
crypto calls and two receive jobs. Only one receive job and one active external
crypto call may belong to an account. Different accounts can progress together.
Queued calls have opaque, monotonically allocated identities; they do not hold
message bodies or keys.

A receive identity belongs to one attached client and one account authority.
Closing or hiding the last visible private view cancels that account's receive
identity and its queued or running read calls. An explicit archive or send call
has no read-demand identity and can finish without a visible conversation.

The first refused, unsupported, missing, or actually timed-out external signer
call pauses its account before a queued call can start. The Worker removes the
account's automatic private wants and releases queued calls. A valid explicit
reopen or Retry clears the pause. Replies from an old identity cannot pause a
replacement identity or release its active slot.

The gate distinguishes cancellation from refusal. Hiding a view, losing a client,
locking an account, replacing its signer, or stopping the Worker invalidates
identities before effect callbacks run. Cancellation does not become a new
signer refusal or an undecryptable envelope.

## Effects and cleanup

The Worker keeps one abort controller for each of the eight possible external
calls. Waiting calls are awakened by a bounded promise. A released call aborts
its wait, correlation entry and owned bunker sockets. No Host borrow is held
across an await. A pending extension API promise cannot be forcibly cancelled
inside the extension; its old correlation is removed and its eventual reply is
ignored. The frontend separately releases its abandoned extension queue.

Every gift-wrap layer checks the original receive identity before using its
plaintext or asking for the next layer. Native local crypto uses the same
account/read checks but creates no external prompt. The archive seed wrap and
unwrap use this same crypto gate, so archive refusal pauses later prompts for
that account too.

Signer replies use a plain JavaScript error object. A default
`serde_wasm_bindgen` map is not compatible with `Reflect.get("error")`; using
one previously collapsed unsupported errors into refused errors.

## Deadlines and private RPC errors

An active signer call has a 60-second deadline, capped by the remaining
operation budget. An actual private signer deadline reports `signer-timeout`.
Queue-budget expiry, socket loss, timer creation failure and cancellation do
not invent this code.

The private bunker helper retains the exact authenticated `unsupported` error
and its own actual deadline. Arbitrary remote error text, including a claimed
timeout, is treated as refusal. Other existing RPC callers keep their previous
error mapping. All success, error, abort and deadline paths close the RPC's
temporary sockets.

## Account replacement

Each Core account has a nonsecret, serde-skipped authority counter. Replacing
the same public key with an extension, a bunker session, a local key, or a
successfully imported encrypted key advances that counter. Selecting an
unchanged account, updating read marks, or importing its read-only public key
does not.

After a successful account transaction, the Worker updates the authority lease
and synchronously removes old receive jobs, queued plaintext archive jobs,
cached archive keys and old crypto effects before acknowledging the mutation.
Durable encrypted archives and committed read marks remain available to the
replacement signer. Failed key imports do not change authority.

These leases cover one engine Host. They do not claim immediate authority
synchronization between unrelated dedicated Workers. The encrypted archive's
separate IndexedDB generation/CAS guard prevents old removal-era writes from
resurrecting a removed account.

## Regression commands

Native cases cover per-account ordering, first-failure draining, stale replies
after retry, read-demand cancellation, explicit archive preservation, detach,
replacement, fixed bounds, encrypted migration and private RPC error mapping:

```sh
cargo test -p lkjstr-core --test engine_dm_signers_test --test engine_dm_authority_test
cargo test -p lkjstr-protocol --test engine_private_rpc_test
```

The focused browser command uses a real production Worker package, a fresh
owned context, random fixture keys held in Rust helpers and an ephemeral
loopback server. Its Worker bootstrap blocks every non-loopback WebSocket.
It never discovers a saved browser profile or connects to an external account.

```sh
cargo build -p lkjstr-core --example engine-fixtures --example engine-bunker
LKJSTR_ENGINE_PKG=tmp/engine-pkg node scripts/engine-dm-signer-harness.mjs
```

Set `CARGO_TARGET_DIR` to the shared worktree target when using an isolated
checkout. `LKJSTR_ENGINE_REPORT` selects an ignored evidence directory.
`--before` runs the existing receive cases against an immutable older package;
it deliberately omits archive actions absent from that package and the actual
60-second deadline check. The current run also checks archive seed refusal,
replacement during a first save, and both actual extension and bunker deadlines.

## Measured browser evidence

On 2026-11-16, the frozen production package with WASM
`ded9b5cd7d27a59966dc709afc1c22938f31980d653b59f1ef5e23a1502181c0`
failed 17 of 25 receive checks. It started two extension calls per account,
accepted old refusal replies after Retry, retained hidden/replaced blocked jobs
and bunker sockets, and collapsed unsupported into refused. Its native local
decryption check passed. The run was 10:03:53.145--10:04:19.407 UTC; load averages
were 6.35/6.78/6.06 at start and 4.52/6.31/5.92 at finish.

The corrected production WASM
`31ca2d67f2f4a03c67b035f86e8fe8d7ba074fbc50aa8aa3b621aaf0f2bd827c`
passed all 44 checks at 10:14:43.253--10:16:05.764 UTC. Load averages were
4.97/4.25/4.95 at start and 9.08/5.90/5.48 at finish. Both actual signer
deadlines elapsed while the requests were withheld; the measured joint wait
was 60,002 ms. Retry then decrypted both cached messages with each signer,
and the old extension replies and bunker responses did not relatch the account.

The corrected run also passed archive refusal for extension and bunker,
same-public-key replacement before archive acknowledgement, no stale first-save
commit, and absence of fixture plaintext from durable storage. Those archive
checks have no claimed before comparison: the earlier package lacked the API.
The later initial-load seed establishment change is not in this frozen package.

Evidence: `tmp/dm-signers-before-complete/report.json` and
`tmp/dm-signers-after/report.json`, with adjacent logs. Initial setup attempts
are retained separately and excluded from product conclusions. Every owned
browser, loopback listener and native signer helper was closed after both runs.

## Explicit Worker stop

A stopped handle cannot resume. A shared cleanup helper first closes and mutes
its Sink, then revokes DM/archive/signer/upload work. It drops Host Accounts,
queued account actions, pre-load inputs, the in-memory Engine and per-client
Sessions. This also drops private-list policy, core anchors and queued
projections. Post-stop input is rejected before decoding or queueing, and the
timer cannot rearm. Late effects have a closed Sink. No durable account, event,
read mark or archive is written or deleted by this cleanup.

This is an ownership guarantee for the stopped Host. An already-running
account-mutation future can hold its own cloned account snapshot until its
bounded effect settles. Its existing stopped check prevents reinstalling that
snapshot. The change does not promise erasure of freed allocator bytes, browser
copies or unrelated asynchronous copies, and does not change ordinary lock or
remove behavior.

`node scripts/engine-stop.mjs` requires `--features harness`;
`LKJSTR_ENGINE_PKG` selects the immutable package. Its feature-only probes
return counts, never private bodies or keys. `scripts/engine-check.sh` runs it
before the main protocol suite. Production packages omit those probes.

The fixture creates an owned local account through the real API and initializes
its encrypted archive. It primes private messages, archive work, a queued
account password, a pre-load input and private policy/session data. It retains
dedicated, shared and port-host handles across stop, stale input and a 50 ms wait.
A new Worker must recover the durable account and unchanged archive revision.
No relay is permitted; every owned browser, Worker and server is closed.

On 2026-11-16, the first proof failed 10 of 34 checks at
10:43:40.060-10:43:40.788 UTC, load 5.18/4.35/4.82. Its initial fix passed 34/34
at 10:44:50.339-10:44:51.051 UTC, load 4.60/4.38/4.79. Artifacts are
`tmp/stop-before/report.json` and `tmp/stop-after/report.json`, with WASM hashes
`ab0246b7c2fb588de12044e5e83cdbbd9dabe24ff0dc034eec19857f23a3e89d` and
`92228d2ac09819490124644bc08cf90a89b674b7a3afd693e01ab4b528f89911`.

The expanded ownership proof then failed 13 of 46 checks at
11:31:17.828-11:31:18.466 UTC, load 1.34/1.79/2.00 to 1.56/1.83/2.01.
Account/startup queues and private projections remained after stop; stale input
grew those queues, and a late dedicated effect still posted. The unified cleanup
passed all 46 at 11:32:59.768-11:33:00.429 UTC, load 1.36/1.74/1.96 throughout.
The retained collections stayed empty, repeated stop remained harmless and
durable restart recovery passed. WASM-target strict clippy passed in 0.48 s.
These checks do not claim completion or erasure of an already-running mutation.

Expanded reports: `tmp/stop-queues-before/report.json` and
`tmp/stop-queues-after/report.json`. Their frozen WASM hashes are
`5592f9e691c6eba7a67d17d262edd4f131db1bec6ffd39c8df18d852b2bd340f` and
`7baaf3544db8a7cbe0b7940b003894afca25fe3c5f07a70f173d5baf4de5d701`.

The port-host extension failed three checks at 11:39:43.271-11:39:44.300 UTC,
load 1.25/1.89/1.97. A same-global replacement then failed three idempotence
checks at 11:43:18.939-11:43:19.991 UTC, load 0.83/1.42/1.77. Clearing each
global handler only at first stop and closing rejected ports passed 72/72 at
11:44:47.944-11:44:48.994 UTC, load 1.33/1.42/1.74 to 1.55/1.47/1.75.
`tmp/stop-port-before/report.json` and `tmp/stop-replacement-before/report.json`
retain failures; `tmp/stop-port-after/report.json` records the final pass.
Final frozen WASM:
`6df2a532d857f91fccf675458662d079b6e152e2d94477ceaa159b61a54d333f`.
