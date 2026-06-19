# Testing Ownership

## Purpose

Testing ownership maps each behavior to the smallest reliable test layer. The
repository favors many focused tests over browser workflow suites.

## Unit And Pure Reducers

Unit tests own deterministic behavior:

- Workspace commands, resize math, layout tree transforms, tab registry, New
  Tab choices, and tab snapshot save/load/delete rules.
- Settings schema, flat key-value persistence, and override stores.
- Protocol parsing, event normalization, filters, tag helpers, NIP-19, relay URL
  normalization, signing helpers, content parsing, media extraction, and custom
  emoji rules.
- Feed merge reducers, display bounds, scroll anchors, cursors, window caps,
  coverage intervals, row planning states, and footer phases.
- Retention scoring, byte accounting, protected-row decisions, deletion
  dispatch, repair planning, pressure stop reasons, and LOD forgetting plans.
- Relay set selection, disabled-relay exclusion, subscription lease keys, page
  read dedupe, limiter cancellation, relay score reducers, route trust, scan
  density, and wait policy.
- Stats projection reducers for storage, relay, optimizer, runtime, and memory
  diagnostics.

## Repository And Worker Integration

Repository tests own durable behavior without a full browser app flow:

- SQLite worker protocol requests and typed response shapes.
- OPFS availability, temporary-memory fallback, blocked storage, corrupt rows,
  timeouts, and unavailable states.
- Event, tag, relay provenance, feed page, notification, job, relay settings,
  app log, cache ledger, inventory, and retention repositories.
- Cache repair and compaction batches with protected rows present.
- Old IndexedDB presence diagnostics that do not scan every old row.

## Host Boundary

Host-boundary tests are allowed only when Node cannot model the API precisely:

- Worker module loading.
- OPFS or official SQLite WASM host behavior.
- Browser timeout and WebSocket host adapters.
- WASM bridge loading and explicit bridge-unavailable states.

These tests stay narrow. They do not drive the tiled workspace through a
browser page.

## Smoke

Smoke checks prove production packaging:

- `app-smoke` builds the production app, starts preview, fetches `/`, and
  verifies a nonblank workspace shell response.
- `cloudflare:quiet` runs the SvelteKit Cloudflare build and Wrangler dry-run.
- Docker Compose builds and runs `app`, `verify`, `cloudflare`, and
  `app-smoke` from images without mounting the source tree.

## Manual Diagnostics

Manual diagnostics are useful but not canonical automated gates:

- Browser heap snapshots and long-session storage observation.
- Real relay sessions under selected user relay sets.
- Mobile and desktop visual inspection of workspace interactions.
- Production host header checks when deployment access exists.

Manual findings should become small reducer, repository, host-boundary, or smoke
tests whenever the behavior can be isolated cheaply.
