# Home History Verification

## Purpose

Record bounded Rust Home history behavior and its exact verification limits.

## Scope

The 2026-09-29 Rust Home slice extends baseline `35d9fe79` with explicit older
reads. It does not establish full Home parity or allow TypeScript deletion.
See the [Home contract](../../architecture/feeds/sources/home.md).

The initial relay request asks for the latest 30 matching events through now.
An older request preserves the loaded account/follow author set and selected
read relays, keeps `until` inclusive, and checks the compound timestamp/id
boundary locally. Wire-filter mismatches and events after relay completion are
not admitted. Incoming event ids are deduplicated with relay provenance.

The owner-local window contains at most 180 events and moves toward older rows
instead of repeatedly discarding them at the newest-window cap. One older read
can be active per owner. Owner generation, request leases, and UI cleanup reject
stale results and close released reads. Empty, failed, or nonadvancing bounded
responses do not establish global history exhaustion; the UI keeps a diagnostic
and explicit retry rather than creating an automatic loop.

## Focused Evidence

These checks passed before the artifact gate:

- `cargo test -p lkjstr-app --test home_feed_paging_test`: 6 passed. Timestamp/id
  ties, deduplication/provenance, 180-event movement, initial newest retention,
  empty/failed/cancelled reads, and footer eligibility are covered.
- `cargo test -p lkjstr-ui --lib home_older`: 3 passed. Duplicate clicks, release
  and late completion, synchronous rejection, and unsupported providers are covered.
- `cargo check -p lkjstr-web --target wasm32-unknown-unknown`: passed.
- `cargo check -p lkjstr-web --target wasm32-unknown-unknown --test home_feed_older_test`: passed.

## Manual Browser Diagnostic

The focused Chrome 154 diagnostic passed both `home_feed_older_test` and the
existing `home_feed_relay_provider_test`, one test each. The measured browser
bodies took 0.13 and 0.16 seconds respectively, excluding compilation/startup.

This runs the actual Rust/WASM Home provider and UI with controlled WebSocket
fixtures and unavailable-cache input, not a real public-relay availability test.
It covers initial history, retained authors/relays, inclusive cursor requests,
rejected author/kind/time/tie inputs, deduplication, disabled repeated clicks,
empty-result diagnostics, explicit retry, unmount cleanup, and existing degraded
follow discovery. No account signing or publishing is involved.

```sh
wasm-pack test --chrome --headless --chromedriver "$CHROMEDRIVER" \
  crates/lkjstr-web --test home_feed_older_test \
  --test home_feed_relay_provider_test
```

Use a matching Chrome binary via `WASM_BINDGEN_TEST_WEBDRIVER_JSON` and a bounded
`WASM_BINDGEN_TEST_TIMEOUT=30`. This remains a manual diagnostic. The existing
browser-test suspension in local quiet gates, Docker gates, and CI is unchanged.

## Artifact and Deployment Boundary

The frozen implementation source is `31369fd6a767fc9ae73287d9b08f38dd206745d4`
(tree `64dde0625151deb5fd7da36170aa04367a5896c9`). Later reporting changes are
documentation-only.

The following complete gates passed on that source:

- `pnpm check:repo`, formatting, and `pnpm rust-wasm:quiet`.
- Docker Compose configuration and builds of `app`, `verify`, `cloudflare`,
  and `app-smoke`, followed by successful runs of all three verification services.
- Cloudflare emitted-WASM checks, the real local Worker smoke, and Wrangler
  deployment dry-run. The dry-run did not publish a Worker.
- The `self-hosted` Docker target and its Rust asset-tree check, including the
  final image carrying the exact source revision label.

The final local image ID is
`sha256:83252d62f571ddb1f9624c98704afe5eecd1032e3c2c0864a0c69c4f4f50af56`.
A separate loopback candidate on port 18880 passed the Rust readiness probe,
manifest-listed bridge checks, SQLite WASM validation, identity/gzip/Brotli,
404/405/HEAD semantics, and fresh Chromium startup/privacy-choice reload.
The browser reported no page exceptions or local HTTP errors. These diagnostics
used fresh ephemeral contexts and did not sign accounts or publish Nostr events.

The existing `lkjstr-selfhost` Compose preview was then updated by the exact
local image ID, without changing its loopback port 18879. Compose health waiting
and a Rust readiness probe passed, and container image/revision/health/port were
re-read successfully. The previous verified `lkjstr:172594f0` image is retained
for rollback. The image has not been published to a registry.

A second HTTP/browser diagnostic was launched against the updated port 18879.
The subsequent combined result-read and Coder HTTPS check was blocked by the
tool safety check. Its outcome is not claimed as passed. Candidate browser
success and post-switch process readiness are distinct from a confirmed
post-switch browser or authenticated Coder-proxy session.

The production domain and both known management-host addresses timed out from
the Coder workspace. No DNS, TLS, firewall, proxy, or infrastructure state was
changed. The infrastructure checkout also contains unrelated ahead/untracked
work and was not used as a deployment shortcut.

## Remaining Work

NIP-65 older author routing, per-relay gap refill, older cache-coverage proof,
automatic scroll paging, and healthy persistent-cache Home browser integration
remain outside this proof.
Dense same-second relay limits may prevent forward cursor progress; this slice
reports that boundary instead of skipping unseen tied events. Full browser Rust
migration, retained-code deletion, and public-domain deployment remain open.
