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

The complete Rust quiet gate and Docker artifact gates have not yet been
recorded for this slice. The running preview remains the previous verified
`172594f0` artifact until the new artifact is verified and explicitly replaced.

The production domain and both known management-host addresses timed out from
the Coder workspace. No DNS, TLS, firewall, proxy, or infrastructure state was
changed. The infrastructure checkout also contains unrelated ahead/untracked
work and was not used as a deployment shortcut.

## Remaining Work

NIP-65 older author routing, older cache-coverage proof, automatic scroll paging,
and healthy persistent-cache browser integration remain outside this proof.
Dense same-second relay limits may prevent forward cursor progress; this slice
reports that boundary instead of skipping unseen tied events. Full browser Rust
migration, retained-code deletion, and public-domain deployment remain open.
