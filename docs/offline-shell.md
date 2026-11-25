# Offline shell

## Purpose

The service worker is build/transport glue, not an event store or a signer.
Real builds emit sw.js from web/scripts/shell-cache.ts. The app registers it
after startup with updateViaCache: none. Mock builds do not register a worker.
Only packaged, same-origin static assets enter the shell cache. The worker also
manages a separate, optional cache of eligible public avatars.

Installation requires a secure context, Service Worker, CacheStorage, SHA-256
and Web Locks. Unsupported or denied capabilities leave the online app usable.
Web Locks coordinates same-origin workers across generations; the lock name
is stable across builds. The app has one root-scope registration per origin.
The generated app offers a verified waiting shell a handoff. Handoff activates
with skipWaiting and claims clients without navigating them. On an ordinary
reload already in progress, the app can reload once into the new graph. If a
draft or post is active, it shows a reload notice and leaves the document open.
An older app without the handoff protocol can discover the verified replacement
on its first reload and use it on the next request after activation.

## Immutable installation

The manifest contains at most 64 packaged paths and SHA-256 digests. The build
identity hashes both that manifest and the worker template. A new installation
reserves a random cache name under a short exclusive lock. Its assets download
four at a time with credentials omitted, redirects rejected and a 60-second
aggregate deadline. Downloads never hold the cache lock.

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

The image loader can reuse a browser-local copy of a public note author's
profile picture after reload. An image must first load successfully. In the
background the service worker checks an anonymous, CORS-readable copy of the
same HTTPS address. It stores only decodable raster images with a positive
cache lifetime, for at most an hour of reuse. The cache holds up to 64 images
of at most 128 KiB each and evicts the oldest writes first.

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
- One ordinary reload activates and adopts an update in a warm browser with two
  tabs. A draft keeps its old document and receives the reload notice.
- A public CORS avatar survives a reload and origin loss. Opaque, private,
  oversized and unselected images stay out of the avatar cache. Expiry and
  capacity restore the ordinary image path.

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
