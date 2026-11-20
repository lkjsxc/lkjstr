# Cache repeat measurement

## Purpose

Measure what a reader can reuse after ordinary public reading, then reload
and repeat the same visits. This is separate from the opening comparison and
the existing public network audit. It changes no product words or layout.

## Commands

Use a previously built real package. This command does not start Cargo.

~~~sh
pnpm cache:repeat --build=/absolute/path/to/frozen/dist --seconds=3600
pnpm cache:repeat --build=/absolute/path/to/frozen/dist --seconds=3600 --network-route=host
pnpm test:harnesses
~~~

The default is 3600 seconds per phase and 30 seconds per visit, plus bounded
setup and final verification. Only one browser harness may run at a time.
Use a fresh output path under this worktree's tmp directory. Existing output
and browser profiles are refused.

A calibration can use seconds=270 and visit-seconds=15. It is always marked
short-calibration and cannot satisfy the hour protocol, even if a stalled
browser makes the wall-clock time exceed an hour.

Options are build, output, seconds, visit-seconds, account, search,
network-route and schema. Supply them as --name=value. Account accepts only
a valid npub or a 64-digit hexadecimal public key. The default is the same
busy public reader as the opening comparison. Schema must match the measured
package; the account transaction fence uses schema 2.

## Visit protocol

1. Create fresh owned browser data with only one read-only public identity.
   No secret, encrypted key, remote signer or owner browser data is imported.
2. Copy the exact real build and record all file digests. Serve it with the
   observed production MIME, CSP, compression and HTTP caching rules.
3. Open Home. Freeze up to twelve rendered note IDs and their public authors.
   The thread and profile targets cycle through these public observations.
4. Follow the saved schedule across Home, threads, profiles, notifications,
   bookmarks, following, followers, search and relays. Close and reopen tiles
   through existing controls; an already mounted tab cannot count as a hit.
5. For feed views, scroll by three quarters of the viewport and return to the
   original position at the recorded fractions of each visit.
6. Finish on Home, reload the page, then replay the same target pool, order,
   dwell budgets and scroll actions. HTTP cache, service worker and stored
   events remain warm. A full browser restart is not claimed.

The schedule has fixed deadlines and at most 480 visits per phase. Slow or
unavailable views do not shorten the scheduled hour. Overruns are reported.
The final Home step makes the reload intent the same as the first opening.
Preparation for people lists uses the existing profile controls in both
phases; all traffic during that preparation remains in the phase totals.

## What the evidence means

The browser probe observes ordinary DOM and Worker messages without changing
the application store. A frame after the DOM contains a visible keyed row
marks first content. A held screen requires its previously visible row keys
in the same order, resolved names and any pictures that were previously
decoded. Names are matched to their public identity, including custom emoji;
intentional unlabeled auxiliary faces are not assigned somebody else's name.
An unresolved name-to-identity match cannot prove hydrated paint. This is a
frame/DOM paint proxy, not a compositor screenshot timestamp.

The probe runs DOM scans after mutation, scrolling, resize or image load.
It keeps at most 10000 public author identities, 128 open query mappings and
256 raw-name spans per visit. Overflow invalidates the affected cache claim.

A held screen within 100 ms is reported separately from a confirmed cache
paint. Confirmation additionally requires no relay EVENT received during
the visit before that frame. Overlapping traffic or uncertain receipt clocks
makes origin unproven. Any incoming frame captured during the visit without
a handshake clock makes it unproven, even if host delivery followed paint.
The number of all relay replies before paint is also
recorded, so an EVENT-free result is not mistaken for no network dependency.

A separate secondary count accepts the optional lkjstr.public-cache Performance
mark only when its source, timestamp and row count match the actually painted
held screen. A mark alone is never a cache hit. Reports say whether any mark
was observed; older builds have no such observability. The comparable primary
before-EVENT result remains unchanged.

Passive CDP observations count events and received/sent WebSocket payload
bytes across every measured application target. HTTP encoded transfer bytes
are separate. WebSocket framing, TLS and compression are not included.
Clock mapping uses the socket handshake's wall and monotonic times. Event
bodies are discarded; only bounded IDs and receipt metadata are kept.

Second/first ratios use the same scheduled phase windows. A zero first-phase
denominator is unavailable, never a zero-cost success. Cache share includes
only targets whose preceding visit actually established content; the report
also lists all unavailable kinds and missing-content attempts.

Known-author regressions require an author with a previously resolved visible
name to appear as a raw key for more than 100 ms. Identities that never had a
resolved name are recorded separately and do not become a false hydration
success. Author metadata is never inferred from private message traffic.

## Scope and limits

Named lists have an engine source but no mounted tile in this frontend.
Existing following/follower and relay lists are measured; named-list paint
remains a coverage gap. Empty or encrypted-only public bookmarks cannot be
invented as evidence. Known empty-state cache readiness needs an explicit
engine witness before it can count as a held screen.

Keyed rows, names and decoded avatar pictures do not prove retained reaction,
repost or zap counts, NIP-05 verification state, reserved media dimensions or
relay-row metadata. Those fields require separate witnesses and remain gaps.

Private messages are excluded from the public account. Their cache behavior
requires a separate unlocked loopback fixture with owned keys and relays.
This command cannot claim that coverage.

The default route uses the workspace network and a loopback app server.
The optional host route preserves original public HTTPS URLs, SNI, TLS
certificates and asset bytes through an owned SSH forward. It changes no
host configuration. Its origin-scoped browser permission, probe and cleanup
evidence are retained. Other public origins keep the workspace network path.

## Results and lifecycle

Each run writes report.json and report.md, exact target/schedule metadata,
build and harness digests, UTC dates, load averages and guard evidence.
A completed hour requires both scheduled phases, their full duration and
successful read-only checks. Finite unit checks are not public measurements.

Signals stop the protocol honestly, save partial evidence and close owned
browser, server and SSH resources. Owned browser data is removed after both
phases or a failure. No owner state or other service is touched.

As of 2026-11-17, the finite schedule, traffic and DOM regression checks pass.
Browser calibration and the two public hours are pending the shared browser
reservation. No improvement percentage or completed-hour result is claimed.
