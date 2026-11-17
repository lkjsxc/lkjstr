# Optional core coordinator for exact-ID local reads

## Purpose

Define a bounded, opt-in Engine-owned disk read gate for concrete public
IDs, including ownership, cancellation, validation and network fallback.

## Status

This is a staged Q1 component, not an enabled browser feature. Native Engine
defaults to local-read work disabled. It can describe bounded exact-ID jobs
but cannot read IndexedDB. The production Worker must bind these jobs to the
existing single public-cache/IDB bridge and prove cache-first warm opening
before enabling it. No new frontend message, view, wording or storage path.

## Why the coordinator is separate

A relay filter containing concrete event IDs can often be answered from the
already verified durable public store. Individual tabs must not race each
other's local reads or independently decide what to ask of relays. The Engine
tracks current want owners and issues one disk job per missing ID before
letting the ordinary relay planner see that exact-ID gap.

Only public-eligible views and kinds enter this path. The centralized
eligibility gate excludes any projection affected by private membership,
DM wrappers, signer RPC and unsupported private event bodies. Exact IDs must
be syntactically valid. Other filter predicates remain intact; this gate
does not claim full anonymous query coverage from an ID alone.

## Host API and bounded lifetime

- `set_local_reads_enabled(true, now)` only when existing public IDB storage is
  ready; it replans without changing the engine/client protocol.
- `drain_local_reads(now)` returns batches containing `job, ids, deadline,
  max_bytes`. Up to 32 IDs per job, two jobs in flight, 2048 tracked IDs
  including negative-evidence cooldowns, 500 ms total deadline, and 4 MiB
  returned bytes. The host must stop at the byte limit and report which
  IDs were actually examined, including misses.
- `local_read_live(job, now)` is the cancellation signal for asynchronous
  host work. It turns false after the final owner closes, a generation reset,
  deadline, or account-policy revocation.
- `finish_local_read(job, result, now)` accepts partial completions. Each
  completed ID may provide at most one bounded, well-formed public Record.
  The retained receipt binds exact event bytes; unreceipted rows
  follow the existing verification queue, never a trusted shortcut.
- A partial unread suffix retries after 25 ms. A failed or completed miss
  falls back to network immediately, with a 30 s bounded local miss cooldown.
  Expiry of that cooldown triggers replanning even with the original view
  still open. Stale callbacks cannot commit after cancellation or re-enable.
- Held verified events, queued verification, and an already-asked ID are
  not separately read from disk. Deletion tombstones carry an author, so an
  unknown target ID cannot be assumed deleted regardless of its author.
  Pending disk IDs do not establish absence or complete pagination; the
  existing network exhaustion predicate needs a successful relay page.

## Integration constraints

The host must reuse the committed `worker_public_cache` transport and its
single `browser/idb_public` connection; no new IDB database or main-thread
record parser is permitted. Keep private account-origin storage separate.

The primary shared relay scheduler must preserve the original filter's
remaining kinds, authors and tags when a local exact-ID result settles.
Retaining an already requested typed-ID atom after a partial completion is
a separate scheduler issue: this coordinator must not claim that typed
partial network requests are replay-free until the primary ID-gap regression
passes. A verified durable relay/filter coverage witness, not this exact-ID
API, is required for avoiding repeated broad Home/profile pages at startup.

The API is not wired to the production Worker, is disabled in existing
deployments, and has no scorecard improvement or browser-first-paint claim.
Only a merged, provenance-matched real Worker/browser test can change that.
