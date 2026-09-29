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

## Current Home-history preview

The later Home-history implementation `31369fd6` passed the complete Rust quiet
and Docker artifact gates and a separate candidate HTTP/browser diagnostic.
The existing loopback preview was updated to its exact local image ID and
passed the post-switch Rust readiness probe. Public-domain deployment remains
uncompleted. The [Home history record](verification/home-history.md) gives the
image identity, scope, rollback boundary, and blocked final diagnostic follow-up.

## Initial September 29, 2026 verification record

The implementation candidate is `172594f0605b7c34a527abffa8ce507b7ceb84ab`
(tree `1185ff553e5a88cb82e2ee8345143e5b63353f27`).
It follows the hosting implementation in `00467d12` and includes equivalent
identity-default simplifications required by Rust 1.98 Clippy. No warning
suppression or browser behavior change was introduced by those simplifications.

| Check                                        | Observed result                                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Native host tests                            | 14 passed, including HTTP and invalid asset trees                                                    |
| Focused emitted-WASM verifier tests          | 8 passed, including four new static-target cases                                                     |
| Workspace native tests                       | 875 passed; no ignored tests                                                                         |
| Native workspace Clippy                      | Passed with all targets and warnings denied                                                          |
| `lkjstr-web` wasm32 Clippy                   | Passed with all targets and warnings denied                                                          |
| `cargo fmt --check`                          | Passed                                                                                               |
| `pnpm test:quiet`, `pnpm lint`, `pnpm check` | Passed; Svelte reported zero errors and warnings                                                     |
| Repository, documentation and line checks    | Passed                                                                                               |
| Self-hosted image build                      | Passed, including the final Rust startup asset check                                                 |
| Live HTTP and compressed assets              | Passed for identity, gzip and Brotli                                                                 |
| Fresh Chromium diagnostic                    | Visible workspace; WASM and SQLite worker assets loaded without page exceptions or local HTTP errors |
| Chromium reload diagnostic                   | Reject-all privacy choice persisted through reload                                                   |

The existing `app`, `verify`, `cloudflare` and `app-smoke` images were also built.
Cloudflare's real local Worker smoke and Wrangler deployment dry-run passed;
the dry-run did not publish a Worker. The existing preview `app-smoke` passed.
GitHub repository CI run `36524315275` passed on `12b6af1b`; this lightweight CI
checks repository structure and does not replace the local runtime gates.

The first Docker verification image exposed missing README files in newly
tracked host source/test directories. Those navigation-only issues were fixed
in `12b6af1b`, and tracked repository checks passed. The verification image was
rebuilt with that correction and completed
`cargo run -p lkjstr-xtask -- quiet docker-verify` successfully (exit zero).
At that initial checkpoint, application source, dependencies and build
configuration were unchanged from `172594f0`; the following commits only
corrected navigation or recorded verification.

That preview ran `lkjstr:172594f0` with its OCI revision label matching the
candidate above. The local Docker image ID is
`sha256:020464aabc8cd691f73f9fc48718f727ce2631e5f394abf9f2fa6ff001e1da21`.
It was rebuilt from the committed source and the live checks were repeated after
switching to it; the first exploratory build is not the final candidate.
The image is local to the development workspace, not published to a registry.

The running container was inspected as user `65532:65532`, read-only, loopback
port `18879`, memory limit 256 MiB and PID limit 64. Node, pnpm, Cargo and rustc
were absent from the runtime image. The Rust readiness probe succeeded.
The preceding preview container stopped gracefully with exit code zero, without
an out-of-memory kill, before the verified candidate replaced it.

Live checks verified manifest-listed bridge bytes and imports, WASM MIME types,
valid SQLite WASM, `Vary: Accept-Encoding`, absent global COOP/COEP, real 404/405
responses and an empty HEAD body. The browser diagnostics used fresh ephemeral
contexts and made no signing accounts, key exports or Nostr publications.
They are manual diagnostics, not a newly enabled automatic E2E gate or proof of
full signing/publishing parity.

The Coder HTTPS preview endpoint responded with 303 to its authentication flow.
The browser application itself was verified on workspace loopback; a logged-in
end-to-end Coder proxy session was not tested. The requested public domain still
timed out, as did the known LAN and Tailscale host SSH endpoints. Private
infrastructure state and DNS/TLS/edge configuration remain untouched. The
application service is prepared; public-domain provisioning is not completed.

Rust reported a non-fatal future-incompatibility notice for the upstream
`proc-macro-error2` dependency. Browser source is still Svelte/TypeScript plus
Rust/WASM; this record does not claim completion of the Rust browser migration.
