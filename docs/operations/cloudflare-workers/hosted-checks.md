# Hosted Bridge Checks

## Purpose

Define live checks for `lkjstr.com` after an operator deploys the verified
Cloudflare artifact.

## Checks

Fetch the shell and bridge manifest:

```sh
curl -I https://lkjstr.com/
curl -I https://lkjstr.com/lkjstr-web-wasm/asset-manifest.json
```

Then fetch the manifest body, fetch the listed JavaScript and WASM paths, and
confirm the WASM response begins with bytes `00 61 73 6d`.

## Browser Observation

Hard refresh `https://lkjstr.com`, open developer tools, and confirm feed
surfaces show real relay, cache, loading, unavailable, unsupported, partial, or
proven-empty states. Raw `spawnSync wasm-pack ENOENT` and `wasm-pack unavailable`
text must not appear in user-facing UI.
