# Account persistence release evidence

## Purpose

Bind the completed release checks to the account persistence source and exact
production artifacts. [Account persistence](account-persistence.md) owns the
implementation scope, focused before/after proofs and eleven-stage gate table.
This supplement records actual maintained-command execution, its production
Storage companion, the final source guard and two fixture-only corrections.

## Source and artifact binding

All thirteen recorded stages passed against runtime/fixture checkpoint
`04c10b9b69dfb60a26b469954e221bcf7fe9ff67`. Their source manifest SHA-256 is
`c321c48f2641269fc1d22c91ba4640906fa762c48fe99819357bacc3e3c5a73b`.
The preserved documentation descendant
`62fbf5fe85aeef3418704c304c2791776ca52bfa` changes only
`docs/account-persistence.md` and `docs/status.md`. The final extractor verifies
that all 1,170 non-Markdown tracked inputs still equal the gated checkpoint;
it does not silently substitute the later HEAD for the source that was tested.

The final extraction was recorded at 23:44:52 UTC on 2026-11-16:
`tmp/account-release-final-04c10b9b/evidence.json`.
Its SHA-256 is
`05654b73e17a6c5fef7fa870efb5c12f2d1a7c290ef37ade74e5ea2377fddf3c`.
The ledger retains every attempt, source manifest, log and scoped cleanup result.
Standalone Cargo invocations refresh their owned Rust sources explicitly; fixed
nested gate commands inherit their enclosing stage's refresh.

Final production artifacts:

- WASM SHA-256:
  `59e2121a2dfc9c5c2f1e10963edf65f0f18c4fed0d5f86e0f4f0a1869c727cc5`.
- Loader SHA-256:
  `d69b6219eb9201b6b84c6579ff07ff1dd8b0993b026470a92e8351522fc1f179`.
- Frozen directory: `tmp/account-release-artifacts/b0d374a40363595f9c56`.
- Frozen file-map SHA-256 (the runner's sorted JSON metadata):
  `b0d374a40363595f9c56e5cfb10bfa34e0168ea564f833fc2186fa8eb5327cfe`.

These bytes equal the earlier focused corrected package. The maintained wrapper
was nevertheless executed after the eleven gates, proving the maintained entry
point itself. Its older production comparison remains the immutable ninth
package with WASM `9088e280`; the complete identity is in account-persistence.md.

## Maintained production checks

Both additional commands passed on 2026-11-16. Times below are the enclosing
recorded stage durations, with UTC start/end and host load averages shown.

| Stage | UTC interval | Seconds | Start load | End load | Result |
| --- | --- | ---: | --- | --- | --- |
| accounts contract | 23:39:31.692-23:40:09.655 | 37.889 | 7.04 / 6.06 / 5.49 | 6.63 / 6.07 / 5.52 | race 12/12; guards 105/105 |
| production Storage | 23:40:09.720-23:40:11.005 | 1.211 | 6.63 / 6.07 / 5.52 | 6.63 / 6.07 / 5.52 | 19/19 |

`pnpm accounts:check` audited explicit current and older production package
identities, then invoked the race and actual IndexedDB guard helpers into
separate fresh reports. It finished successfully without cancellation. The
wrapper's own interval was 23:39:32.461-23:40:09.599 UTC; this is distinct from
the enclosing 37.889-second command record. No build is implicit in the command.

Wrapper report: `tmp/account-contract-final/report.json`.
SHA-256: `4fdbfd3cb53d0bb529138f2a218087c7aa1020bfed5e57eac4efd86d96ea242d`.

The wrapper's current-source child reports are:

- Race: `tmp/account-contract-final/race/report.json`, 12/12 in 1.908 seconds,
  23:39:33.123-23:39:35.031 UTC, load 6.80 / 6.02 / 5.48 at both endpoints.
  SHA-256: `d308e14248ea5a3c1eb551803635c864c1c6cb1c3e2a36a300ac8e5ae2dce0c2`.
- Guards: `tmp/account-contract-final/guards/report.json`, 105/105 in 34.339
  seconds, 23:39:35.248-23:40:09.587 UTC, load 6.80 / 6.02 / 5.48 to
  6.63 / 6.07 / 5.52.
  SHA-256: `5260af95cbc7b8ab1584f5f7b15f7fb04a885922cb305bf1e87b68626b0ca2e0`.

Both child reports confirm Worker/context/browser/server teardown, reaped
browser identity and temporary-directory removal. Earlier focused evidence is
preserved separately. The prior strengthened shared-owner 10-assertion replay
is an overlapping subset of the 105 guards, not 115 unique assertions.

Storage report: `tmp/account-production-storage/report.json`.
SHA-256: `06cfb177ff9ab2dc9e2a23363601031fa8496cf748e33fc97bd3edb4718ca07d`.
Its internal interval was 23:40:10.098-23:40:10.961 UTC, or 0.863 seconds;
load was 6.63 / 6.07 / 5.52. All 19 assertions passed on the final production
WASM above, separately from earlier harness-build Storage checks.

## Preserved fixture corrections

The first full engine attempt passed the first 18 Storage assertions, then
waited for a message to pass through a port that failed-boot Detach had already
closed. The fixture now observes either that attempted inspection or closure of
the exact originating port after Detach, with an independent heartbeat control.
The original no-response and estimate-count assertions are retained. Its
failed log, report and package remain in `tmp/storage-detach-proof/before/`.
The corrected focused 19/19 replay remains in
`tmp/storage-detach-proof/after/report.json`; final production coverage is above.

The next engine attempt passed Storage, then failed a private-cache fixture
whose failure injection intercepted only account writes. Lock now correctly
validates freshness without rewriting durable credentials, so that injection
never fired. The fixture now aborts the owned readwrite transaction reading
engine-accounts and positively observes injection consumption plus the actual
abort event for both failed Lock and failed Remove. The authorized private-row,
successful revocation and hidden-anchor assertions remain unchanged.

The second attempt's log, report and immutable package are retained in
`tmp/private-revoke-proof/before/`. The corrected 11/11 replay is
`tmp/private-revoke-proof/after2/report.json`, SHA-256
`24a2fff174bcb24e45264fc1f28cf4ed909473e08898a60edda8825d866378b6`.
It took 9.618 seconds internally and 9.830 seconds for its outer command, from
23:07:03.779 to 23:07:13.417 UTC. Load changed from 1.75 / 3.33 / 4.73 to
1.79 / 3.29 / 4.70. Both contexts were observed; page errors and outside HTTP
were zero; every owned cleanup check passed. The first replay's optional
context-error observer gap is documented separately and is not used for that
observer claim. Both fixture corrections changed no runtime or WASM bytes.

The corrected full engine attempt passed in 328.904 seconds at unchanged
04c10b9b; the remaining ten release stages then passed at the same checkpoint.
The final two maintained production checks above bring this evidence set to
thirteen successful stages. Their exact timestamps, loads and hashes remain in
the extraction and ledger rather than being inferred from a later build.

## Limits and deployment

Conflicts still require explicit reload; no automatic cross-Worker account
reconciliation or global Lock was added. The fresh-key before proof establishes
the failure mode, not an incident involving the owner's keys. Public ninth-hour
measurements used earlier frozen source d0a4c3d7 and do not measure this account
correction. Browser effect proofs do not establish physical JavaScript memory
zeroization. No new deployment is claimed without its prescribed ship receipt.
