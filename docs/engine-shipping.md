# Engine shipping

## Purpose

Keep deployment tied to tested source, the exact archive and observed HTTPS
bytes. The prescribed direction-folder wrapper delegates to `scripts/ship.sh`
in the current worktree. It never changes the host's management checkout.

## Host rejection and correction

The ce05e292 archive transferred successfully on 2026-11-16, then the host
validator rejected it with `Index needs JS and WASM references`. A read-only
host reproduction observed that exact error on the same 1,539,617-byte archive,
SHA-256 `c5380f86904ddbf27e4017d139395fe0169e6be809dc2e2cf4785ae0cbc35b87`.
The failed receipt had no activated successor. This was a stale host assumption,
not an archive-transfer or live-switch failure.

GitOps PR 103 adds the bounded generated import/Worker/loader graph to the host
and guest validator. The corrected validator accepts all 34 archive files
without changing a byte. Missing dependencies, orphan WASM, unsafe local paths,
invalid headers and comment/string/regex decoys fail. A 1,024-asset graph bound
is independent of archive limits. The same reviewed graph source is transferred
to the guest in memory; archive contents are never executed.

The existing workflow is the controller's trust anchor. Its exact bytes stay
unchanged; the existing hosting-test entrypoint includes the new graph tests.
Branch, PR, exact-commit CI, merge, main CI and the existing timer are required.
No controller rule, service, state or secret is changed to bypass that route.

## Source and activation order

Run from a clean worktree containing `origin/main`:

```sh
setsid nohup /home/coder/workspace/lkjstr-direction-20261116/ship.sh \
  "One Japanese owner line" >/dev/null 2>&1 &
```

The shared ship lock precedes replacing `tmp/ship.out` and `tmp/ship.log`.
The helper runs web check, the full real smoke and real build/package, preserves
the exact archive and checks the clean source revision again. A dry-run push
checks authentication before these expensive gates. Build XDG isolation must
not hide an existing GitHub login: an explicit GH_CONFIG_DIR is preserved;
a login in the selected XDG directory is preserved; otherwise the ordinary
home-directory gh login is selected when it exists. No credential is copied,
printed or stored in shipment evidence. It pushes the
tested commit before any host operation, then fetches and requires exact main.
An authentication or concurrent-main failure cannot produce a deployment.
There is no best-effort push after activation.

Host transfer is digest checked. The normal host CLI keeps identity checks,
the global writer lock, receipts, atomic switching and failure restoration.
Only its explicit lock-contention exit 75 is retried; a transport error may
have occurred after activation and is never blindly retried. Failed or
ambiguous results require inspecting the receipt and current release.

Successful deployment and verification must report the exact packaged index
SHA-256. The host checks every asset, root/SPA responses, security/cache headers,
MIME types, missing-file responses and actual gzip bytes through its own edge's
HTTPS loopback with real hostname and CA validation. The wrapper does not depend
on the old LAN address. This proves the served origin bytes, not an external
Internet path or an interactive browser session.

Each attempt retains its revision, tarball, deployment/verification receipts
and summary in `tmp/ship-<UTC>-<pid>/`. Only a fully verified shipment sends the
owner line. A failed owner notification records `SHIPPED ...; desk note failed`,
so publication is not falsely denied and can be reported without redeploying.
The successful timestamp is shared between worktrees and enforces two hours
between shipments. A build or host failure does not advance it.

## First schema-2 rollback baseline

The account-store correction preserves existing rows while moving IndexedDB
from schema 1 to 2 to fence obsolete whole-snapshot writers. The old live
541e4a1e runtime cannot open that newer schema; retaining its files alone is not
an operational rollback for a browser that has migrated.

For the first tested account-safe shipment, append
`--establish-rollback-baseline` to the command above. It deploys and verifies
the exact same archive twice through the normal host CLI. The second receipt
must name the first verified release as its predecessor. One owner note is
sent. The ordinary rollback target then contains the verified schema-2 runtime
before any subsequent performance shipment. Old release directories remain.
This establishes a compatible baseline, not a distinct earlier feature set.

If the second deployment fails, no completed-baseline note or success timestamp
is written. The first safe release remains the expected recovery target and
the result says that the baseline is incomplete. Inspect the host receipt and
current release before retrying. Do not activate the schema-1 predecessor for
users who have migrated. Browser data is never deleted to make a rollback fit.

## Resource ownership and verification

Builds and tests stay at four jobs/threads. Development/test debug information
and incremental artifacts are disabled; production release settings do not
change. After successful shipment, a process check defers cleanup while any
owned compiler, gate or debug binary is active. Otherwise Cargo cleans only
the dev profile in a target directory belonging to a listed repository
worktree. A target outside the repository is refused. Deferred cleanup is
recorded in the log and must be completed once the active work has stopped.
Keep the shared target below 25 GiB and remove merged integration trees.

`node --test scripts/ship.test.mjs` executes the actual shell against isolated
Git repositories and a simulated host CLI, never the live host. It covers
rejected pushes, isolated-XDG and explicit authentication, missing credentials
before expensive gates, changed source, exact receipt/hash checks, one owner note,
lock-only retries, incomplete-baseline retry, notification failure, the shared
ship interval, active-build cleanup deferral and unrelated-target refusal.
Host graph/rollback/HTTPS tests and an exact archived-build proof are separate.
These finite proofs do not certify a live deployment; record its receipts and
schema-compatible IDs after the prescribed command finishes.
