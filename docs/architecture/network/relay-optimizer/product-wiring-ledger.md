# Product Wiring Ledger

## Purpose

This ledger maps shipped browser feed surfaces to the adaptive scan model. It
keeps the pure Rust/WASM contract, SQLite evidence rows, and TypeScript host
runtime honest while the feed runtime cutover continues.

## Surface Ledger

| Surface | Adaptive grouped scan | Rust/WASM planner | SQLite density read | Observation and model write | Trace and Stats | Fallback |
| ------- | --------------------- | ----------------- | ------------------- | --------------------------- | --------------- | -------- |
| Home | implemented through timeline page reads | open as primary product path | implemented for warm span choice | implemented for older and newer scans | Stats and debug read durable rows | selected relays and current span policy |
| Global | implemented through timeline page reads | open as primary product path | implemented for warm span choice | implemented for older and newer scans | Stats and debug read durable rows | selected relays and current span policy |
| Profile posts | implemented through profile route plans | open as primary product path | implemented for warm span choice | implemented for older and newer scans | Stats and debug read durable rows | selected relays plus route groups |
| Notifications | implemented for older notification feed pages | open as primary product path | implemented for warm span choice | implemented for older scans | Stats and debug read durable rows | selected notification relays |
| Custom Request event-list | implemented only for safe time-windowable filters | open as primary product path | open for product span choice | current hints and coverage now; density rows open | durable rows visible when present | selected relays and exact mode when unsafe |
| Thread | exact read semantics | not used | not used | not used | not used | exact id and bounded thread filters |
| Search | exact search semantics | not used | not used | not used | not used | cached search plus relay NIP-50 |
| Author Context | exact author context semantics | not used | not used | not used | not used | exact author reads |
| Metadata and references | exact lookup semantics | not used | not used | not used | not used | exact ids, profiles, and references |

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
