# Hosting needs

## Purpose

What a static host must do to serve the build in `dist/` made by `web/`.
The browser works on any static host meeting this list; previews are optional.
`web/scripts/serve.ts` is the reference implementation and what the smoke
test runs against.

## Files

`pnpm build` in `web/` writes everything to `dist/` at the repository root:

| File | Notes |
| --- | --- |
| `index.html` | The only page of the app. References the files below by absolute path |
| `app-<hash>.js`, `boot-<hash>.js`, `app-<hash>.css` | Interface; `boot` is a classic script, `app` a module |
| `engine-<hash>.js` | Real Transport adapter, or the mock worker in a mock build |
| `engine-{wasm,shared,worker}-<hash>.js` | Real build: WASM glue and both worker entries |
| `engine-<hash>.wasm` | Only in a build made with `--engine=<dir>` |
| `privacy.html`, `LICENSE.txt` | Static pages linked from the About tab |
| `sw.js` | Real builds only: integrity-checked offline shell and atomic updates |
| `icon.svg`, `icon-192.png`, `icon-512.png`, `favicon.ico`, `manifest.webmanifest` | Icons and the web app manifest |

The site is served from the root of its origin (`/`), over HTTPS.

## Routing

- A path that names an existing file serves that file.
- Any other path without a dot in it (`/`, `/n/<note>`, `/p/<npub>`) serves
  `index.html` with status 200. The app opens the link as a tab and puts the
  address back to `/`.
- A missing path with a dot is a 404, so a stale hashed file never comes back
  as HTML.

## Content types

| Extension | Type |
| --- | --- |
| `.html` | `text/html; charset=utf-8` |
| `.js` | `text/javascript; charset=utf-8` |
| `.css` | `text/css; charset=utf-8` |
| `.wasm` | `application/wasm` (required: the engine compiles while streaming) |
| `.webmanifest` | `application/manifest+json` |
| `.svg`, `.png`, `.ico`, `.txt` | The usual ones |

## Headers

On every response:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:; img-src 'self' https: data: blob:; media-src 'self' https: data: blob:; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

- `'wasm-unsafe-eval'` is what lets the engine instantiate WebAssembly; there
  is no inline script and no `eval`.
- `'unsafe-inline'` for styles covers the `style` attributes that size media
  boxes and avatars before they load.
- `connect-src https: wss:` is the relays and the media upload servers the
  reader chooses; `img-src` and `media-src` are the pictures and video in
  notes. `worker-src` falls back to `script-src 'self'`: the engine worker is
  same-origin.

Cross-origin isolation (`Cross-Origin-Opener-Policy: same-origin` with
`Cross-Origin-Embedder-Policy`) is **not** sent and must not be added as it
stands: `require-corp` would block the pictures and video that notes embed
from other origins. The interface needs neither. If the engine ever wants
`SharedArrayBuffer` (WASM threads), that is a decision to take together,
with `COEP: credentialless` and a fallback for browsers without it.

## Caching

| What | `Cache-Control` |
| --- | --- |
| Files with a content hash in the name (`*-<16 hex>.js`, `.css`, `.wasm`) | `public, max-age=31536000, immutable` |
| Everything else, `index.html` above all | `no-cache` (revalidate every time) |

A deploy is then atomic for the reader: a new `index.html` names new files,
and old tabs keep working from the files they already hold. Keep the previous
build's hashed files for a while after a deploy so a tab that loaded the old
`index.html` can still fetch its worker.

Compression (brotli or gzip) for `.js`, `.css`, `.html` and `.wasm` is
expected of the host; nothing is precompressed.

## What the host does not need

No server-side rendering, no required API, no WebSocket endpoint, no cookies, no
relay proxy, no accounts. The real build registers a same-origin service worker.
Its complete asset manifest is SHA-256 checked before installation succeeds.
Each new attempt has a separate cache and a build-bound completion marker.
Failed installs preserve both active and waiting shells, including a rollback
to the active build. Missing cached assets use the same integrity check online.
Activation waits for every old controlled client; no open draft is taken over.
Cleanup retains the active, waiting and current installer, at most three shell
copies across repeated updates. An interrupted activation retries cleanup on the
first controlled fetch; fetches never recreate retired caches. Short Web Locks
serialize allocation, completion and cleanup; network downloads hold no lock.
Root/note/profile navigation works from the cached shell. Only packaged static
assets are cached: no events, keys, uploads or remote media. Serve sw.js with
no-cache as above; no new headers or backend are required. CacheStorage and
Web Locks must be available for shell installation. Storage or locking denial
keeps the normal online app operational. Shell installation does not make
uncached notes or pictures available offline. Design and regression evidence:
[offline-shell.md](offline-shell.md).

## Checking a host

```sh
curl -sI https://<host>/ | grep -i -e content-security -e cache-control
curl -sI https://<host>/p/npub1example | head -1          # 200, text/html
curl -sI https://<host>/missing.js | head -1              # 404
curl -sI https://<host>/engine-<hash>.wasm | grep -i content-type
```

## Optional preview route

The separate lkjstr-preview Rust binary serves GET /preview?url= and
GET /preview/health. Route these exact paths before the SPA fallback, preserving
the path. A missing service must return an error or HTML without health JSON;
the Worker then keeps links plain. The service binds loopback, with a writable
bounded cache directory. The edge overwrites X-Real-IP with the real client
address, disables access and error logs for these routes, and retains the
site security headers. Do not cache preview JSON in shared HTTP caches.
No new CORS origin, iframe policy, script permission or cookie is required.

## Public documents

Serve /en/*.html and /ja/*.html as text/html; /sitemap.txt and /robots.txt
as text/plain; charset=utf-8. Public HTML, site.css and discovery files
revalidate with no-cache, like privacy.html. Keep these concrete paths ahead
of any app fallback. The UTF-8 text sitemap lists /, privacy.html and all seven
page pairs, one absolute URL per line. Hreflang stays in each page's alternate
links. XML is not an accepted release type and the edge has no XML MIME mapping.
The app shell has no canonical or alternate links: every href/src in index.html
must name a packaged local file. Its absolute og:url metadata remains valid.
Packaging rejects inline scripts and event attributes in every HTML file.
It also rejects base elements in every HTML file and network-path URLs in
index references or static scripts, which must resolve to packaged local files.
The root dist check requires the seven bilingual page pairs and their shared
assets. No ops deployment verification list exists in this checkout.


## Release archive graph

The exact archive preflight follows generated local JS imports, Worker and
loader URL references from the root HTML to WASM. A document-level WASM preload
is unnecessary; an orphan WASM file does not certify a real build. All reached
assets must be present and nonempty, and reached WASM must have its header.
The graph is bounded at 1024 distinct assets and skips text/comment/regex
decoys. Existing archive and HTML/CSP restrictions remain; no archive contents
are extracted or executed. See engine-startup.md for the dated before/after
package proof and the failed sixth ship's deployment boundary.

The standalone package command additionally requires one unambiguous reachable
production engine pair and checks its actual WASM exports and generated bindings.
It audits byte ranges in the same validated raw tar before gzip/output, so an
older existing dist cannot bypass the real-build export guard. Extra WASM files,
harness controls and mixed stale bindings fail closed. The generic archive
validator retains its graph semantics; dated evidence is in engine-package.md.
