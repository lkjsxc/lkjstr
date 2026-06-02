# App Boundary

## Purpose

This file defines the Rust application composition boundary. Status:
implemented for pure account-domain records, local signing helpers, account
storage command wiring, relay-set storage command wiring, workspace layout
reducers, tab movement reducers, workspace startup recovery, bounded tab
snapshot staging, startup filtering of stored tab snapshots, feed-window
reducers, live feed composition, Home, Global, Profile, Notifications, Search,
and Custom Request feed input builders, the Custom Request parser, and New Tab
catalog options; design-only for remaining browser service composition.

## Owner

`lkjstr-app` owns browser-local product services. It is not a server backend and
does not introduce remote account state.

## Responsibilities

- Start the workspace root and recover to Welcome when storage is unavailable.
- Own shared Home query state above tab components.
- Own timeline, profile, thread, notification, search, and tool runtimes.
- Coordinate Tweet signing, queueing, drafts, and publish jobs. Current Rust
  implementation owns protected Tweet draft load/save commands; signing,
  queueing, and publish jobs remain open until their Rust runtimes exist.
- Own account selection and secret repository wiring above the pure
  `lkjstr-domain` account helpers. The Rust host keeps account rows and local
  signing secrets in separate protected stores.
- Own relay-set edit commands and selected default relay-set persistence above
  the pure `lkjstr-domain` relay-set reducers.
- Own Upload Settings commands for shared Tweet media configuration and route
  NIP-96 discovery to the browser host.
- Route UI commands to protocol, relay, storage, and host services.
- Expose compact view models and command results to `lkjstr-ui`.
- Own startup recovery, job recovery, account selection, and settings loading.

## Boundaries

- Pure product state lives in `lkjstr-domain`.
- Workspace layout, tab groups, tab records, focus, startup layout, tab opening,
  pane splitting, tab movement, edge-drop pane insertion, tab close recovery,
  and zero-layout recovery are pure `lkjstr-domain` reducers.
- New Tab labels, groups, descriptions, and active-account profile config are
  pure `lkjstr-domain` catalog data.
- Tab snapshot payloads, feed/tool snapshot merge semantics, feed restore seeds,
  anchors, and bounded runtime snapshot ID lists are pure `lkjstr-domain`
  models.
- Workspace startup recovery, stored tab snapshot filtering, and warm tab
  snapshot staging are pure `lkjstr-app` composition reducers.
- Protocol validation and signing live in `lkjstr-protocol`.
- Relay scheduling and subscription state live in `lkjstr-relays`.
- Durable storage repositories live in `lkjstr-storage`.
- Browser APIs live in `lkjstr-web`.
- Leptos components live in `lkjstr-ui`.

## Command Contract

Commands return typed results rather than throwing through UI paths. Recoverable
failures become explicit unavailable, blocked, quota, corrupt, timeout, or
canceled states.

App commands do not pass large event objects through component context. They
pass IDs, compact row models, storage keys, and resource-owner handles.

## Cleanup

Every runtime created by `lkjstr-app` has an idempotent close path. Closing a
tab or workspace releases live relay demands, pending reads, timers, workers,
DOM listeners owned through host adapters, and transient memory pins.
