# lkjstr-host

## Purpose

Serve the verified static Nostr browser application without a Node server.
This native crate is separate from the Rust/WASM browser migration.

## Table of Contents

- [Cargo.toml](Cargo.toml): native runtime and test dependencies.
- [src/](src/): asset validation, HTTP service and command-line entry.
- [tests/](tests/): native HTTP and invalid-deployment regression tests.

## Contract

The process never owns accounts, signing keys, user storage or relay connections.
The existing edge owns HTTPS. Do not add blanket COOP/COEP headers or a successful
HTML fallback for missing JavaScript or WASM files.

See [status](../../docs/status.md): this server still validates the old bridge
layout and rejects the current frontend dist/ until it is adapted. Product
preview uses web/scripts/serve.ts.

## Optional page previews

`cargo build --release -p lkjstr-host --bin lkjstr-preview` builds a separate
loopback service; it does not serve or validate the static release. Configure
`LKJSTR_PREVIEW_CACHE` (required writable directory), `LKJSTR_PREVIEW_BIND`
(default 127.0.0.1:18880), and `LKJSTR_PREVIEW_ORIGIN` (the site origin).
GET /preview/health returns a versioned JSON health response; GET /preview
accepts one url query parameter. Only the loopback edge may supply X-Real-IP.
The edge must overwrite it and disable request/error logging for these paths.
The service logs no request details. Preview fetching is optional in the app;
no successful health response means plain links and no metadata requests.
See [preview source](src/preview/README.md) and docs/hosting-needs.md.
