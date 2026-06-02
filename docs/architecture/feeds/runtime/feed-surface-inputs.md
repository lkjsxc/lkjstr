# Feed Surface Inputs

## Purpose

Define canonical Rust builders for surface-specific feed query inputs.

Status: Rust owns Home and Global live query input builders. The next pure
builder slice covers Profile and Notifications so route isolation and
notification `#p` targeting are fixed before UI wiring. These builders are app
runtime composition only; shipped feed UI wiring still uses TypeScript runtime
code.

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

## Profile

- Surface is `Profile`.
- Channel is `notes`.
- Phase is `Live`.
- Purpose is `Feed`.
- Filters include kinds `1`, `6`, and `16`.
- Filters include exactly the viewed profile pubkey as the author.
- Selected relays remain the base and fallback.
- Author route evidence is limited to the viewed profile pubkey.
- Disabled relays pass through to route planning.
- The builder must not inherit Home follow authors.

## Notifications

- Surface is `Notifications`.
- Channel is `notifications`.
- Phase is `Live`.
- Purpose is `Feed`.
- Filters include kinds `0`, `1`, `6`, `7`, `16`, and `9735`.
- Filters include tag `#p` targeting exactly the active account pubkey.
- Filters must not include `authors`.
- Selected relays remain the base and fallback.
- Author route evidence is limited to the active account pubkey.
- Disabled relays pass through to route planning.
- The builder must not reuse Home author-list semantics.

## Source

- `crates/lkjstr-app/src/feed/surface_inputs.rs`: Home, Global, Profile, and
  Notifications live input builders.
- `crates/lkjstr-app/tests/feed_surface_input_test.rs`: builder contract tests.
