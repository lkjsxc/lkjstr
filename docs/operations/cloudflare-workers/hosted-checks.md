# Hosted Bridge Checks

## Purpose

Define live checks for `lkjstr.com` after an operator deploys the verified
Cloudflare artifact.

## Automated Check

Run the hosted smoke against the public origin:

```sh
pnpm hosted:smoke -- https://lkjstr.com
```

The script fetches `/`, the bridge manifest, the listed JavaScript bridge, the
listed WASM binary, and a missing bridge asset path.

## Required Assertions

- `/` returns a successful HTML app shell and not the SvelteKit `500` page.
- The manifest returns JSON with `Cache-Control: no-cache`.
- The manifest names content-addressed JavaScript and WASM assets under
  `/lkjstr-web-wasm/`.
- The JavaScript and WASM responses match manifest byte counts and SHA-256
  digests.
- The JavaScript bridge is a wasm-bindgen module.
- The WASM response has `application/wasm` content type and begins with bytes
  `00 61 73 6d`.
- A missing bridge asset does not return `200` root HTML fallback.

## Manual Check

Hard refresh `https://lkjstr.com`, open developer tools, and confirm feed
surfaces show real relay, cache, loading, unavailable, unsupported, partial, or
proven-empty states. Raw `spawnSync wasm-pack ENOENT` and `wasm-pack unavailable`
text must not appear in user-facing UI.
