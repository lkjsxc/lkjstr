# Self-hosting

## Purpose

Define the self-hosted application boundary, verification, and deployment handoff.

## Contract

The self-hosted target serves the existing browser-first Nostr application,
not the separate lkjscript language documentation site. The browser remains
Svelte/TypeScript plus Rust/WASM during migration. Production HTTP serving is
owned by `lkjstr-host`, a Rust binary; Node and pnpm are build dependencies only.
The default Cloudflare build stays unchanged.

The deployment boundary is:

`lkjstr.lkjsxc.com` -> existing HTTPS edge -> private HTTP -> `lkjstr-host`.

Do not create a second DNS record, tunnel, certificate authority, host firewall,
or OpenTofu state for resources already owned by the private management repo.
No signing keys, accounts, relay proxy, or user database live in this container.
Browser-local data belongs to the origin: changing from another domain does not
migrate accounts or local storage. Do not silently redirect the old origin.

## Build and run

```sh
docker build --target self-hosted -t lkjstr:self-hosted .
docker run --rm --read-only --cap-drop ALL --security-opt no-new-privileges \
  -p 127.0.0.1:18879:8080 lkjstr:self-hosted
```

The build emits the static SPA, verifies its WASM manifest and imported snippets,
and checks the final asset tree with the Rust host. The runtime image contains
neither Node nor pnpm nor a build toolchain. It runs as an unprivileged user.
The existing `app` image is still a development preview, not this runtime.

The Rust CLI also supports:

```sh
lkjstr-host check /srv/lkjstr
lkjstr-host serve /srv/lkjstr 127.0.0.1:8080
lkjstr-host probe 127.0.0.1:8080
```

The asset tree must be a deployment-only directory. Symlinks and special files
are rejected at startup; keep it immutable for the lifetime of the process.
`/healthz` reports process readiness after startup validation. Only GET and HEAD
are served. Missing assets and unknown routes return 404, never a success HTML
fallback. Dotfiles and deployment control files are not public assets.
Mutable manifests and entry HTML revalidate; no response is cached indefinitely.
WASM uses `application/wasm`. Global COOP/COEP headers remain absent, matching the
existing OPFS sahpool and arbitrary Nostr media contract in the root `_headers`.
The existing TLS edge must preserve these response semantics.

## GitOps / OpenTofu boundary

`deploy/compose.yaml` describes the isolated application process. Set
`LKJSTR_IMAGE` to a verified image digest in private deployment configuration.
It binds loopback by default; do not expose an unauthenticated Docker API or
management port to make deployment easier. A proxy in another container needs
an explicitly managed private network rather than this loopback example.

The private infrastructure repository remains the owner of the Incus instance,
private routing, the HTTPS virtual host, and any DNS/TLS resources it already
manages. Add this application to that existing stack only after checking the
live host and its authoritative state. Review a saved OpenTofu plan before
applying that exact plan; do not import or recreate existing resources blindly.
A Git commit or an image build is not evidence that the domain is deployed.

Before changing the edge, validate the candidate privately, retain the previous
image and route, and change only the lkjstr virtual host. Afterward check HTTPS,
`/`, the manifest, every bridge import, WASM MIME and bytes, SQLite assets,
404/405 behavior, and real browser startup. Roll back the image/route if any
check fails. An HTTP smoke test alone does not prove Nostr signing or publishing.

## Verification

Native host tests are `cargo test -p lkjstr-host` and crate-scoped clippy. Build
the `self-hosted` Docker target and probe the resulting container. Browser
workflow suites remain optional and are not added to the normal CI gate.

The September 29, 2026 workspace check found that both host SSH and HTTPS to
`lkjstr.lkjsxc.com` timed out from the common Coder environment. No DNS, TLS,
firewall, private GitOps state, or live edge configuration was changed by that
check. Public-domain readiness must be established separately, not inferred
from a local container test.
