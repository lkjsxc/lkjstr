# Relay Wiring Cutover

## Purpose

This contract defines how Rust relay reducers connect to browser WebSocket,
timer, NIP-11 fetch, diagnostics, and product-surface demand wiring.

## Current Evidence

- Pure relay state and effects live in `crates/lkjstr-relays/src/**`.
- Browser host adapters live in `crates/lkjstr-web/src/relay_host/**`.
- Shipped TypeScript relay code lives in `src/lib/relays/**` and
  `src/lib/relays/orchestration/**`.
- Current Rust proof covers reducer effects, request budgets, page-read dedupe,
  progressive snapshots, route plans, lease fingerprints, scoring, and route
  evidence. Product surfaces still consume TypeScript relay runtime paths.

## Host Adapter Responsibilities

`lkjstr-web` owns only browser effects and cleanup handles:

- open a `web_sys::WebSocket` for a normalized relay URL.
- send a frame that Rust has already accepted.
- close a socket on reducer command or owner teardown.
- install and clear one-shot browser timeouts.
- parse socket text through the protocol bridge and report typed host errors.
- fetch NIP-11 metadata when a Rust request asks for it.
- return diagnostics without deciding feed completeness or route trust.

## Reducer Ownership

`lkjstr-relays` owns these decisions before any browser effect runs:

| Area | Rust source | Required proof |
| ---- | ----------- | -------------- |
| Connection state | `client/state.rs`, `client/reducer.rs` | connect, reconnect, close, final-close tombstone, ignored-after-close tests |
| Effects | `client/effect.rs` | `OpenSocket`, `SendFrame`, `CloseSocket`, timer, diagnostic, and snapshot effects |
| Ingress caps | `ingress.rs` | invalid JSON, oversized frame, and message cap tests |
| Request budget | `request_budget/**`, `request_message_size.rs` | NIP-11 limits, local defaults, clamp diagnostics, size rejection |
| Page dedupe | `page_read/**` | semantic key equality and inequality across surfaces |
| Progressive snapshots | `page_read/progressive*.rs` | fast relay, slow relay, failed relay, timeout, and cancellation snapshots |
| Route planning | `route_plan/**`, `route_evidence/**`, `read_score/**` | disabled exclusion, selected fallback, trust order, advisory scores |
| Live ownership | `demand/**`, `live_lease/**` | shared Home leases, hidden-tab release, final owner cleanup |

## Typed Effect Requests

The product wiring layer uses typed effect requests equivalent to:

```text
open_socket
send_frame
close_socket
set_timeout
clear_timeout
fetch_nip11
record_metric
emit_diagnostic
```

No product surface calls `WebSocket` directly. Effects carry an owner id, relay
URL, request key, and cleanup context so late frames cannot pollute another tab.

## Route Planning Inputs

Rust route plans accept selected read relays, enabled relay set, disabled or
removed relay exclusions, NIP-65 relay lists, NIP-02 follow-list hints, entity
relay hints, tag hints, event relay provenance, route blocks, local evidence,
NIP-11 limits, and optimizer scores. Global uses selected read relays only.

## Cleanup Semantics

Closing a tab releases only leases owned by that tab. Shared page reads continue
while another owner remains. When the final owner closes, Rust emits close and
timer cleanup effects, records a bounded diagnostic, and ignores late host
messages through a final-close tombstone.

## Integration Order

1. Wire Rust relay effects to `lkjstr-web` host handles.
2. Feed Rust demand into the shipped Home read path without deleting TypeScript.
3. Use synthetic relay tests for WebSocket lifecycle and malformed ingress.
4. Move Home, Global, Profile, Thread, Notifications, Search, Custom Request,
   Public Chat, and publish waits onto Rust relay requests one surface at a
   time.
5. Delete `src/lib/relays/**` only after [deletion-ledger.md](deletion-ledger.md)
   records Rust files, tests, Docker evidence, and no-import proof.

## Must Not Clauses

- No fake data.
- No placeholder success.
- No direct browser database access from product code.
- No unbounded arrays.
- No hidden global state.
- No deletion before parity proof.
- No status claim without source/test evidence.
