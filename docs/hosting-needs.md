# Hosting needs

## Purpose

What a static host must do to serve the build in `dist/` made by `web/`.
There is no server-side code: any host that can meet this list will do.
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

No server-side rendering, no API, no WebSocket endpoint, no cookies, no
relay proxy, no accounts. There is no service worker today.

## Checking a host

```sh
curl -sI https://<host>/ | grep -i -e content-security -e cache-control
curl -sI https://<host>/p/npub1example | head -1          # 200, text/html
curl -sI https://<host>/missing.js | head -1              # 404
curl -sI https://<host>/engine-<hash>.wasm | grep -i content-type
```
