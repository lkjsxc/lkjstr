# Acceptance Checks

## Purpose

Automated and manual acceptance checks.

## Details

Automated checks own these assertions through unit, integration, Rust/WASM,
Cloudflare, and app-smoke layers:

- Repository docs, README coverage, line limits, storage manifest docs,
  functional style checks, runtime counter keys, timers, and storage boundaries
  pass.
- Unit and integration tests cover workspace reducers, tab snapshots, settings,
  relay orchestration, feed merge/window reducers, storage repositories,
  retention, inventory, Stats projection, and background cleanup.
- Rust tests cover protocol kernels, feed LOD reducers, retention scoring,
  relay scoring, route-evidence trust, scan density, and storage row codecs
  whenever those pure reducers exist.
- Cloudflare dry-run builds Workers Static Assets with the `ASSETS` binding and
  no app backend, relay proxy, or account service.
- Bridge asset verification checks the Rust/WASM source artifact manifest, the
  emitted Cloudflare manifest, the JavaScript bridge asset, and a non-empty WASM
  binary with bytes `00 61 73 6d`.
- App-smoke builds the production app, serves preview, fetches `/`, verifies a
  nonblank workspace shell response, fetches `/lkjstr-web-wasm/asset-manifest.json`,
  and validates every listed bridge asset.

Manual diagnostics own these observations when a human or agent needs browser
runtime evidence:

- Root route remains visible when local storage, IndexedDB, or OPFS are denied.
- Static hosting serves SQLite worker assets and the Rust/WASM bridge manifest,
  JavaScript, and WASM binary from the hosted asset output.
- Long browser sessions keep UI responsive under relay churn and storage
  pressure.
- Browser heap snapshots and Chromium RSS help investigate memory pressure;
  RSS is diagnostic only.
- Real production hosts return expected headers when deployment access exists;
  `lkjstr.com/lkjstr-web-wasm/asset-manifest.json` lists fetchable bridge assets.

## Real-Data Layout Regression Checklist

Use real-shaped Nostr events through relay-backed or repository-backed paths,
not placeholder UI rows.

- Feed height stability: scroll Home or Global with references, media, custom
  emoji, nested reposts, profiles, reactions, and action summaries resolving
  above the viewport; the visible anchor remains stable and deltas are
  compensated.
- Width buckets: resize a tile across at least two feed width buckets; stale
  measurements from the old bucket do not remain permanent minimums.
- Timeline whitespace: inspect row diagnostics for reservation gaps, content
  trailing blank lines, empty child margins, action/reaction gaps,
  embed/reference gaps, and width-bucket mismatches.
- Notifications: no row renders unread styling, an unread accessible label, or a
  view/focus read-marking mutation; ordering, windowing, paging, and event
  rendering remain unchanged.
- Tab scroll isolation: switch, reorder, split, and close tabs with different
  scroll positions; only the intended tab scroll owner changes.

## Storage Pressure Acceptance

- Stats reads SQLite storage health and mode instead of showing indefinite
  loading.
- Compact keeps protected SQLite rows and reports quota or stop reasons when it
  cannot reach the target.
- If browser usage remains over target, the stop reason is exact:
  `no-prunable-candidates`, `protected-only`, `unknown-unowned-usage`,
  `inventory-incomplete`, `quota-pressure`, `storage-api-unavailable`, or
  `compaction-error`.
- Inventory separates SQLite table estimates, ledger bytes, localStorage, Cache
  Storage, old IndexedDB presence, unknown storage, and residual browser
  overhead without scanning every old row.

## Feed And Relay Acceptance

- Home, Global, Notifications, Thread, and Profile rows preserve real ordering,
  relay provenance, avatar/name fallbacks, timestamps, wrapped content, and
  unavailable reference states backed by real events or compact missing states.
- Cached Home rows render before relay responses and before profile hydration
  when coverage is complete.
- Identity, Profile, Thread, quote, reference, media, notification, and Tweet
  actions are covered by reducer, repository, and component contract tests at
  the smallest useful layer.
- Inactive feed tabs release live relay work and restore from DOM, snapshots, or
  SQLite when reselected.
- Queued relay page reads abort when the owning runtime or subscription manager
  closes and do not remain in limiter queues.
- Relay optimizer Stats rows are real, deduped by stable keys, and resolve to
  available, unavailable, timeout, or memory-fallback states.
