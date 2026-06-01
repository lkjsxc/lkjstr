# Feed Surface Inputs

## Purpose

Define canonical Rust builders for surface-specific feed query inputs.

Status: Rust owns Home and Global live query input builders. They are pure
builders for app runtime composition; shipped feed UI wiring still uses
TypeScript runtime code.

## Home

- Surface is `Home`.
- Channel is `notes`.
- Phase is `Live`.
- Purpose is `Feed`.
- Filters include kinds `1`, `6`, and `16`.
- Filters include the known Home author set.
- Selected relays remain the base relay set.
- Author route evidence and disabled relays pass through to route planning.
- The builder does not create a self-only author fallback when follow discovery
  has not produced an author set.

## Global

- Surface is `Global`.
- Channel is `notes`.
- Phase is `Live`.
- Purpose is `Feed`.
- Filters include kinds `1`, `6`, and `16`.
- Filters do not include authors.
- Author route evidence is discarded.
- Selected relays are the only relay group source.

## Source

- `crates/lkjstr-app/src/feed/surface_inputs.rs`: Home and Global live input
  builders.
- `crates/lkjstr-app/tests/feed_surface_input_test.rs`: builder contract tests.
