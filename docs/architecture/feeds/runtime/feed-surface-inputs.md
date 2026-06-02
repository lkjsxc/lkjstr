# Feed Surface Inputs

## Purpose

Define canonical Rust builders for surface-specific feed query inputs.

Status: Rust owns Home, Global, Profile, Notifications, Thread, Search, and
Custom Request query input builders. The next pure builder slice covers Author
Context anchor and nearby-author queries. These builders are app runtime
composition only; shipped feed UI wiring still uses TypeScript runtime code.

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

## Thread

- Surface is `Thread`.
- Root lookup channel is `thread-root`.
- Reply query channel is `thread-replies`.
- Root lookup phase is `Bootstrap` and purpose is `EventLookup`.
- Reply query phase is supplied by the runtime as `Bootstrap`, `Page`, or
  `Live`.
- Root lookup filters include exact `ids: [eventId]` and limit `1`.
- Reply filters include tag `#e: [eventId]` and kinds `1`, `6`, and `16`.
- Reply filters must not include `authors`.
- Selected relays remain the base and fallback.
- Optional root-author route evidence can target known root routes, but relay
  scoring never suppresses selected fallback relays.

## Author Context

- Surface is `AuthorContext`.
- Anchor lookup channel is `author-context-anchor`.
- Nearby query channel is `author-context-nearby`.
- Anchor lookup phase is `Bootstrap` and purpose is `EventLookup`.
- Nearby query phase is supplied by the runtime as `Bootstrap` or `Page`.
- Anchor lookup filters include exact `ids: [eventId]` and limit `1`.
- Nearby filters include exactly the anchor author as `authors` and display
  kinds `1`, `6`, and `16`.
- Selected relays remain the base and fallback.
- Anchor-author route evidence can target known author routes.

## Search

- Surface is `Search`.
- Channel is `search`.
- Phase is `Page` for submitted queries.
- Purpose is `Search`.
- Filters include the submitted NIP-50 `search` text.
- Filters include kinds `1`, `6`, and `16`.
- Filters must not include `authors`.
- Selected relays are the only relay group source.
- Empty query text is rejected before relay demand creation.

## Custom Request

- Surface is `CustomRequest`.
- Channel is `custom-request`.
- Phase is `Page`.
- Purpose is `Feed`.
- JSON parsing accepts the documented filter, filter-array, request-object, and
  `REQ` shapes.
- JSON above `64 KiB`, more than `8` filters, more than `32` explicit relays,
  more than `500` ids, authors, or tag values, and search strings above `256`
  bytes are rejected before relay demand creation.
- Filter limits above `500` are clamped by app policy.
- Requests with `ids` or `search` use exact mode; other filter lists use
  adaptive feed mode.
- Explicit request relays replace selected relays after normalization; absent
  explicit relays use selected relays.
- Author route evidence is discarded.

## Source

- `crates/lkjstr-app/src/feed/surface_inputs.rs`: Home, Global, Profile, and
  Notifications query input builders.
- `crates/lkjstr-app/src/feed/thread_inputs.rs`: Thread root and reply query
  input builders.
- `crates/lkjstr-app/src/feed/author_context_inputs.rs`: Author Context anchor
  and nearby-author builders.
- `crates/lkjstr-app/src/feed/tool_inputs.rs`: Search and Custom Request query
  input builders.
- `crates/lkjstr-app/src/custom_request/`: Custom Request parser and mode
  classifier.
- `crates/lkjstr-app/tests/feed_surface_input_test.rs`: feed builder tests.
- `crates/lkjstr-app/tests/thread_input_test.rs`: Thread builder tests.
- `crates/lkjstr-app/tests/custom_request_test.rs`: parser and mode tests.
