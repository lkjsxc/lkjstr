# Product Wiring Ledger

## Purpose

This ledger maps shipped browser feed surfaces to the adaptive scan model. It
keeps the pure Rust/WASM contract, SQLite evidence rows, and TypeScript host
runtime honest while the feed runtime cutover continues.

## Surface Ledger

| Surface                   | Adaptive grouped scan                             | Rust/WASM planner                                                               | SQLite density read              | Observation and model write                                            | Trace and Stats                                     | Fallback                                   |
| ------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| Home                      | implemented through timeline page reads           | initial span and reduction use Rust/WASM when available; follow-up windows open | implemented for warm span choice | implemented for older and newer scans through Rust/WASM when available | Stats and debug read durable rows plus bridge state | selected relays and current span policy    |
| Global                    | implemented through timeline page reads           | initial span and reduction use Rust/WASM when available; follow-up windows open | implemented for warm span choice | implemented for older and newer scans through Rust/WASM when available | Stats and debug read durable rows plus bridge state | selected relays and current span policy    |
| Profile posts             | implemented through profile route plans           | initial span and reduction use Rust/WASM when available; follow-up windows open | implemented for warm span choice | implemented for older and newer scans through Rust/WASM when available | Stats and debug read durable rows plus bridge state | selected relays plus route groups          |
| Notifications             | implemented for older notification feed pages     | initial span and reduction use Rust/WASM when available; follow-up windows open | implemented for warm span choice | implemented for older scans through Rust/WASM when available           | Stats and debug read durable rows plus bridge state | selected notification relays               |
| Custom Request event-list | implemented only for safe time-windowable filters | shared scan bridge available when routed through adaptive feed scans            | shared warm span choice          | shared scan-model writer when routed through adaptive feed scans       | durable rows visible when present                   | selected relays and exact mode when unsafe |
| Thread                    | exact read semantics                              | not used                                                                        | not used                         | not used                                                               | not used                                            | exact id and bounded thread filters        |
| Search                    | exact search semantics                            | not used                                                                        | not used                         | not used                                                               | not used                                            | cached search plus relay NIP-50            |
| Author Context            | exact author context semantics                    | not used                                                                        | not used                         | not used                                                               | not used                                            | exact author reads                         |
| Metadata and references   | exact lookup semantics                            | not used                                                                        | not used                         | not used                                                               | not used                                            | exact ids, profiles, and references        |

## Primary Bridge Contract

Product feed reads must use the Rust/WASM bridge as the first span planner when
WASM is available. The TypeScript layer is host glue: it loads the WASM module,
selects SQLite rows, maps DTO fields, executes relay reads, persists rows, and
shows explicit unavailable states. It must not fork scan mathematics without a
visible bridge-unavailable diagnostic.

The product path for each adaptive surface is:

1. build a stable scan context from semantic feed key, route group, relay,
   filter key, direction, and route fingerprint,
2. select Exact plus parent scan density models from SQLite,
3. call `plan_feed_scan_from_js` for the initial relay-shaped segment span,
4. execute real relay reads with that span,
5. call `reduce_feed_scan_observation_from_js` for real observations,
6. persist the observation, updated density models, and decision trace, and
7. expose the chosen span through Stats and redacted debug hooks.

If WASM cannot load, product reads may continue with selected-relay correctness
fallbacks, but Stats and debug must say the Rust scan planner is unavailable.
Unavailable bridge state must never be represented as neutral learned evidence.

## Matching Rules

- Exact scan density models require route fingerprint equality.
- Parent scopes deliberately ignore route fingerprint unless their scope owns it.
- RouteGroup, RelayFilter, SurfaceFilter, Surface, and Global rows never become
  Exact rows by matching only direction or surface.
- Transient tab ids, pane ids, owner handles, request ids, subscription ids,
  and paging cursors stay out of scan model keys.
- Product page reads use separate request dedupe keys and stable scan semantic
  keys so learned spans survive cursor movement.

## Completion Bar

The adaptive scan product path is complete only when Home, Global, Profile
posts, Notifications, and safe Custom Request event-list reads all:

1. select exact and parent models from SQLite,
2. call the Rust/WASM planner for the proposed span,
3. execute real relay reads with the proposed span,
4. reduce real observations through Rust/WASM,
5. persist observations, updated density models, and decision traces, and
6. show real decisions or explicit unavailable states in Stats.
