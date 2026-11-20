# Engine shipping

## Purpose

Keep deployment tied to tested source, the exact archive and observed HTTPS
bytes. The prescribed direction-folder wrapper delegates to `scripts/ship.sh`
in the current worktree. It never changes the host's management checkout.

## Recorded host rejection and correction

The independent host workflow records that the ce05e292 archive transferred on
2026-11-16, then the validator rejected it with
`Index needs JS and WASM references`. Its reproduction used the same
1,539,617-byte archive, SHA-256
`c5380f86904ddbf27e4017d139395fe0169e6be809dc2e2cf4785ae0cbc35b87`,
and reported no activated successor. This stream has not repeated that host
operation outside the prescribed ship command.

GitOps PR 103 records a bounded generated import/Worker/loader graph correction
for the host and guest validator. It accepts all 34 archive files without
changing the archive; missing dependencies, orphan WASM, unsafe paths, invalid
headers and comment/string/regex decoys fail. The graph has a 1,024-asset bound.
These are separate workflow claims, not a successful deployment receipt here.

The existing workflow remains that controller's trust anchor. Its recorded
route requires branch, PR, exact-commit CI, merge, main CI and the existing
timer. No permission for extra host repair is inferred from this document.
This stream uses only the owner-prescribed shipping entry point.

## Source and activation order

Run from a clean worktree containing `origin/main`:

```sh
setsid nohup /home/coder/workspace/lkjstr-direction-20261116/ship.sh \
  "One Japanese owner line" >/dev/null 2>&1 &
```

The launcher pins a full Git revision and loads `ship-run.sh` from that Git
object into Bash memory before gates run. The driver likewise loads its receipt
and cleanup helpers from the same object, then executes their captured bytes.
A later worktree edit cannot replace code already selected for execution.

The shared ship lock precedes replacing `tmp/ship.out` and `tmp/ship.log`.
A dry-run push checks authentication before the expensive gates. Explicit
`GH_CONFIG_DIR` and a login in the selected XDG directory keep precedence;
otherwise an existing home-directory gh login is selected. No credential is
copied, printed or stored in shipment evidence. The driver installs root
dependencies from the frozen lockfile for the copied package fixtures.
The web gates use preinstalled web dependencies.
The archive is copied to the unique run directory and made read-only before
the final HEAD/clean assertion. All later hashes and uploads use that retained
copy. The push names the pinned revision explicitly; a subsequent fetch must
confirm exact main before any host operation. Authentication, source changes
and a competing main update fail before activation.

Host transfer is digest checked. Only explicit lock-contention exit 75 is
retried. A transport error may have occurred after activation and is never
blindly retried. Failed or ambiguous results require the retained receipts;
a missing receipt does not establish that live stayed unchanged.

The deployment receipt must name the tested archive, a passed deployment, a
release ID, and the packaged index hash with the host's required health flags.
The separate verify receipt proves that reported index hash and health flags;
it does not independently bind an archive hash or current release ID.
The reported HTTPS checks cover the origin's own edge path, not an external
Internet path or an interactive browser session.

Each attempt retains its revision, tarball, executed helper bytes and hashes,
deployment/verification receipts and summary in `tmp/ship-<UTC>-<random>/`.
Verified shipments send the owner line unless `LKJSTR_SHIP_NOTIFY=0`.
`SHIPPED ...; desk note failed` records a successful release with a notification failure.

The owner's limit is three hours between attempts. The shared successful
timestamp must also be checked inside the acquired lock: an outer check can
race with another worktree while waiting. A build or host failure does not
advance that successful timestamp; the caller retains attempted-run times
and enforces the remaining interval before starting the prescribed command.

## First schema-2 rollback baseline

The account-store correction preserves existing rows while moving IndexedDB
from schema 1 to 2 to fence obsolete whole-snapshot writers. The old live
541e4a1e runtime cannot open that newer schema; retaining its files alone is not
an operational rollback for a browser that has migrated.

For the first tested account-safe shipment, append
`--establish-rollback-baseline` to the command above. It deploys and verifies
the exact same archive twice through the normal host CLI. The second receipt
must name the first verified release as its predecessor and identify a
different successor. A same-release receipt cannot certify a rollback target.
One owner note is sent. The ordinary rollback target then contains the
verified schema-2 runtime before a subsequent performance shipment.
This establishes a compatible baseline, not a distinct earlier feature set.

If the second deployment fails, no completed-baseline note or successful
timestamp is written. The first safe release is the expected recovery target;
the result says that the baseline is incomplete. Inspect retained evidence
before retrying. Do not activate the schema-1 predecessor for migrated users.
Browser data is never deleted to make a rollback fit.

## Observed account-safe activation (2026-11-17)

At 02:07 UTC the prescribed 07e88178 release passed all seven gates and
548 real interface checks, then deployed and verified two compatible schema-2
releases. Archive SHA-256: eb633111cf2c00df656bf7bbbc396d695b00df51a61796d9a244214b91c311cb.
Index SHA-256: fa3286676dd34d61f91a2e5d060123b7a0ec3fee18a1cdf5184f3e8c0ac16468.
Current release d709e49012af410685572170253e927b; compatible rollback
9528fe7103b7462387235d47ec579285. Exact gate/HTTPS receipts remain
in tmp/ship-20261117T015825Z-386270/.

## Resource ownership

Builds and native tests stay at four jobs/threads. Development/test debug
information and incremental artifacts are disabled; release settings stay
unchanged. Shipping always defers build-artifact cleanup. A process scan cannot
reserve a shared Cargo target between separate proof steps, and absence of a
compiler at one instant does not transfer ownership of its artifacts.

The cleanup helper performs no process scan, Cargo invocation or deletion.
Any later maintenance must be separately coordinated with every target user.
The ship command never removes another worktree or an active proof's package.

## Local regression evidence (2026-11-17)

`node --test scripts/ship.test.mjs` executes the actual shell against isolated
Git repositories, owned archive copies and simulated commands. It makes no
actual SSH, Desk, Cargo or browser calls and does not push the project.

At 00:19:06-00:19:12 UTC the original six safety cases failed as intended while
eleven controls passed. They covered unchanged-successor baseline receipts,
mutable archive/helper/driver inputs, pushing a changed HEAD and unsafe cleanup.
The corrected seventeen-case suite passed before an additional ordering case
was introduced; those reports remain preserved.

The ordering case replaces HEAD and the archive immediately before the owned
copy. At 00:28:31 UTC it failed on the prior implementation in 0.414 seconds:
a replacement archive was retained under the old revision and host effects
occurred. Retaining the archive before the final source assertion prevented
those effects. The unchanged maintained suite passed 18/18 once at
00:28:58-00:29:04 UTC in 6.475 seconds; load changed from 1.37/4.15/6.85 to
1.50/4.13/6.83. All nine files passed syntax checks; owned processes and
fixture directories were empty afterward.

Evidence in `tmp/ship-safety-proof/` is bound by
`snapshot-order-handoff.json`, SHA-256
`ff3bfc700a2c8541b2c681a28498bd58c9e6e2b78b7ad885fccb274c6fd78970`.
The final report hash is
`a95da910d5106d55dcedc2a536694c28badbe13bdbfe491572ba585b3a145932`.
The shared-lock guard now requires 10,800 seconds. A fixed-clock case starts
from fixture success, refuses at 9,000 seconds before any added gate/push/host
action, preserves its stamp, then succeeds at 10,801 seconds. The maintained
suite passed 19/19 in 8.389 seconds at 00:38:04-00:38:12 UTC, with load
4.89/5.17/6.03 to 4.73/5.13/6.01 and empty owned-process/directory audits.
Its retained `cadence-handoff.json` hash is
`c911189bf4f31019ce69f8dd722b560f3c0ac0a4ec3a1010e4991a44d679013a`;
`cadence.json` is
`1eb918e90bcf0c687253a92a08ef38e1b7d702c522322fac64f6ef06ebca745c`.

After rebase onto `07e88178`, all nineteen cases remain and four synthetic
authentication cases cover default fallback, explicit GH configuration, selected
XDG credentials and missing credentials before costly gates. All 23 pass at
02:05:16-02:05:27 UTC in 11.091 seconds, load 4.32/5.23/5.79; owned processes
and fixture directories are empty. Report: `tmp/ship-rebase-proof/tests.json`,
SHA-256 `ecbe78e7409edae34437b06ba25bd9d59a0c81567aa5448fab5537c240876944`.
The account runtime has separate completed [production proof](engine-availability-verification.md).
Host graph/rollback/HTTPS tests remain separate; finite local proof does not
certify live deployment. Retain actual receipts and compatible release IDs.


## Observed compatible shipment (2026-11-17)

Another prescribed-wrapper run shipped `07e88178` at 02:07:15 UTC. Its retained
`tmp/ship-20261117T015825Z-386270/` summary and both deployment/verification
receipts were read after the shared `ship.out` had been replaced by a queued
attempt's interval refusal. That refusal does not undo the completed shipment.
This stream did not initiate either attempt or run another host command.

Both receipts match the retained 1602184-byte archive, SHA-256
`eb633111cf2c00df656bf7bbbc396d695b00df51a61796d9a244214b91c311cb`,
and its index hash
`fa3286676dd34d61f91a2e5d060123b7a0ec3fee18a1cdf5184f3e8c0ac16468`.
The retained real UI report has 548 successful checks and no reported errors.
The local stamp names the same source revision and completion time.

The first compatible release is `9528fe7103b7462387235d47ec579285`;
the second receipt starts there and ends at the distinct current release
`d709e49012af410685572170253e927b`. This establishes the schema-2 rollback
pair. Future ordinary shipments do not need to repeat its baseline mode.
The deployed WASM is
`59e2121a2dfc9c5c2f1e10963edf65f0f18c4fed0d5f86e0f4f0a1869c727cc5`,
not the newer protocol-13 availability marker tested by this stream.

The observation record `tmp/account-release-observed-ship-07e88178.json` binds
the exact local receipts, archive contents, smoke report and stamp. Its hash is
`89a404997f21484938e99ab3d5c5910082988f63f9c8c9b015f595884ebf9763`.
These checks did not independently query DNS/TLS or the current host release;
the host receipts themselves report that external browser verification is false.
The three-hour cadence remains in force; the latest observed attempt ended
at 02:07:15 UTC, so this stream will not attempt another ship before 05:07:16.
