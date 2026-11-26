# Offline shell

## Purpose

The service worker is build/transport glue, not an event store or a signer.
Real builds emit sw.js from web/scripts/shell-cache.ts. The app registers it
after engine readiness with updateViaCache: none. An already-controlled page
checks immediately so an update can repair a broken engine. Mock builds do not
register a worker.
Only packaged, same-origin static assets enter the shell cache. The worker also
manages a separate, optional cache of eligible public avatars.

Installation requires a secure context, Service Worker, CacheStorage, SHA-256
and Web Locks. Unsupported or denied capabilities leave the online app usable.
Web Locks coordinates same-origin workers across generations; the lock name
is stable across builds. The app has one root-scope registration per origin.
Successful registration also counts as the initial script check, avoiding an
immediate duplicate download. A rejected registration or failed first installer
retries after 1, 2, 4, 8, 16 and then 30 seconds, with one attempt in flight.
Hidden and retained-history pages pause retries; online, focus and restoration
resume them. Permanent departure releases timers and owned listeners.
The app checks for updates on boot, then every five minutes while visible.
Returning to the tab or going online checks again when at least one minute
has passed since the last check. The app offers a verified waiting worker
a handoff, which activates it with skipWaiting and claims existing clients.
After a replacement takes control, a visible page reloads once it has been
idle for five seconds and has no active draft, post or focused editing
field. A draft receives a reload notice and keeps its running document.
Pages still running the earlier reload-only client use that client's
handoff behavior until they first load this update.

## Immutable installation

The manifest contains at most 64 packaged paths and SHA-256 digests. The build
identity hashes both that manifest and the worker template. A new installation
reserves a random cache name under a short exclusive lock. Its assets download
four at a time with credentials omitted and redirects rejected. Each download
has a 60-second inactivity bound and a 15-minute total bound; the entire install
also has a 15-minute bound. Downloads never hold the cache lock.

Hash-named immutable assets reuse the HTTP cache after foreground engine loading.
Every reused body still needs its manifest digest. A mismatch or cached HTTP
failure allows one reload
fetch with the same digest check; mutable paths always request fresh bytes.
This avoids downloading the foreground engine twice on a thin connection.

Every asset is verified before being stored. Completion adds a marker bound to
the build only after all writes succeed and the installer still owns its named
cache. Interrupted or failed attempts cannot replace a viable completed shell.
An exact rollback can reuse a complete active/waiting build without rewriting it.
A failed fresh attempt removes only its own name, after its in-flight writes
settle. No installation name is resurrected after retirement.

Readers take shared locks while selecting a complete build and matching an
asset. Missing cached bytes fall back to a credential-free, hash-verified network
fetch. This fallback does not mutate or recreate a cache. Navigation for root,
note and profile routes resolves to that build's verified index.html.

## Bounded maintenance

Before an installation allocates storage, cleanup snapshots candidate names,
then queries active/waiting/installing worker identities with MessageChannels.
Identity handlers never acquire the cache lock. Unknown identities or changed
registration slots abort cleanup before deletion. The current worker supplies
its own identity directly during activation.

Cleanup retains one complete cache for each live build plus the actual current
installer's incomplete stage. Old incomplete stages and superseded waiting
builds are removed. Ordinary waiting updates retain active, previous waiting,
and current installer. A handoff can retain one additional complete predecessor.
The worker verifies predecessor app and engine assets against the hashes in
their content-addressed filenames, then serves them to the existing clients.
Navigation uses the active worker's complete index graph.

A browser may discard or terminate activation work while still advancing the
worker to activated. Cleanup therefore also runs on the first controlled fetch
in each worker runtime, retained with waitUntil. Concurrent fetches share one
maintenance promise. Failed maintenance preserves caches and waits 30 seconds
before a later request can retry. Shell fetches never open a cache, so a retiring
worker cannot recreate a deleted name.

## Public avatars

Remote faces use up to six native image requests per page. Visible faces go
first. An attempt times out after eight seconds and a visible face retries
with an exponential delay capped at 30 seconds. Detached faces release their
pending work. The letter stays in place while an image waits or retries.

The image loader can reuse a browser-local copy of a public note author's
profile picture after reload. An image must first load successfully. In the
background the service worker checks an anonymous, CORS-readable copy of the
same HTTPS address. It stores only decodable raster images with a positive
cache lifetime, for at most an hour of reuse. The cache holds up to 64 images
of at most 128 KiB each and evicts the oldest writes first.

The worker accepts up to 16 copy jobs and runs one at a time, prioritizing
visible offers. Each attempt has a 2.5-second deadline from cache lookup
through decode and storage. Transient failures retry after one and two
seconds, then suppress copies for that URL for up to 30 seconds.

URLs with credentials, a query or an existing fragment use the browser's image
path, as do opaque responses and pictures from private-message views. Private
and no-store responses, accounts, events, keys, uploads and timeline media
stay out of the avatar cache. Missing or expired copies fall through to normal
image loading. Denied storage leaves the online path available.

## Regression evidence

The default web smoke and smoke:offline commands run the packaged-shell check
and both focused helper suites. Every scenario uses a fresh loopback port and
browser context, blocks external DNS and closes owned servers/browsers in
finally. No owner account, public relay or publication is involved.

- Real packaged assets all load offline, including profile deep-link navigation.
- A corrupt new build preserves the active cache; two old tabs delay adoption.
- Active A, waiting B, then corrupt A rollback preserves the complete A shell.
- Active A with repeated B/C/D/E updates keeps caches bounded and preserves A.
- Abandoned incomplete caches sharing a live build prefix are removed.
- A missing cache entry cannot accept a mismatched network response.
- B can activate while C's asset download is held; cleanup preserves C's stage,
  C finishes honestly, and C does not take over an open B tab.
- If activation cleanup is interrupted, a fresh controlled request removes
  retired caches before the fixture claims recovery.
- With two open tabs, a return to the page checks and activates an update.
  The hidden tab keeps its document until it comes back. A draft receives
  the notice and keeps its document until cleared. An idle visible tab
  detects and adopts a later update on its periodic check.
- A public CORS avatar survives a reload and origin loss. Opaque, private,
  oversized and unselected images stay out of the avatar cache. Expiry and
  capacity restore the ordinary image path. A visible avatar recovers after
  a transient HTTP failure on the same image node.

Both original regressions failed against the saved original generator:
rollback deleted A's cached index, and the fourth waiting build left four
caches. Evidence: tmp/offline-updates-before.log. Fixed results are in
tmp/offline-updates-after.log, tmp/offline-races-after.log and
tmp/offline-packaged-after.log. Chromium is the executed browser; Firefox,
Safari and a real OS/browser crash remain unmeasured.

## Primary references

- [Service Worker lifecycle](https://w3c.github.io/ServiceWorker/)
- [Web Locks](https://www.w3.org/TR/web-locks/)
- [WorkerNavigator.locks availability](https://developer.mozilla.org/en-US/docs/Web/API/WorkerNavigator/locks)
