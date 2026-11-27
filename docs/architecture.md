# Architecture

## Purpose

How the single browser product is divided between rendering and engine work.

## Parts

| Part | Role | Browser APIs |
| --- | --- | --- |
| web/ | TypeScript rendering and window manager | DOM, engine transport |
| lkjstr-engine-worker | Worker host and browser effects | sockets, IndexedDB, timers, HTTP |
| lkjstr-core | store, planning, windows, policy and row projection | none |
| lkjstr-protocol | events, signing, NIP-19, filters and messages | none |
| lkjstr-host preview binary | optional public-page metadata, no Nostr state | native HTTP only |
| lkjstr-nips | independent codecs, cryptography and policy | none |
| lkjstr-xtask | repository checks and quiet gates | local commands |

The root Cargo.toml is a virtual workspace. There is no second Rust interface
or root HTML entry. engine/ contains only module loading and transport glue.
The Worker library retains lkjstr_engine as its generated asset basename so
the existing transport contract does not need to change with the crate name.

## Message flow

1. The interface sends open/window/close queries through protocol.ts.
2. wire::Session converts frontend queries to pure Engine inputs and projects
   finished rows back into the same wire protocol.
3. Visible views produce shared relay filters. Author hydration batches profiles
   and prioritizes the relays that delivered visible notes and their context.
4. Network emits owned connect/send/disconnect effects. Worker socket callbacks
   parse frames through the protocol layer and enqueue events for verification.
5. Engine::tick verifies at most 32 events per slice, updates the bounded store,
   replans and emits row patches. Cached profiles are part of the first rows.
   Inputs can advance the next Worker turn to 25 ms. Runnable verification
   yields for 4 ms between slices, while proof recovery and timeline work use
   25 ms turns. A settled host checks relay, expiry and persistence deadlines
   every 500 ms.
6. The Worker persists committed event batches and dispatches results by client.
   Hiding/closing views releases their wants; heartbeat expiry releases clients.
   A returning page probes its Worker and gives it time to answer before replacing the connection.
   An expired client's keyed reading window reopens with that window as its first snapshot.
7. The main thread renders finished rows without parsing events or opening relays.

## Relay decisions

publication_plan.rs makes explicit kind-aware delivery plans; publication_discovery
fills missing inbox lists while writes proceed. Network batches new write sockets
independently of reads and resolves public notes on their first matching positive
OK. Later answers use the bounded Stats receipts and durable deletion-route ledger.
read_plan.rs ranks configured fallback and bounded verified NIP-65 routes by
coverage and measured first-event/EOSE quality without changing chronological
feeds. Progressive readiness does not wait for all EOSE. Route-local cursors
and inclusive cache-gap repair separate logical pages from wire envelopes. Routing and scheduling share lazy account weights per plan;
authorless routes skip graph construction. Device refresh uses per-kind requests.
Bounds, scorecards and deferred work are in
[orchestration.md](orchestration.md) and [outbox.md](outbox.md).

Merged chronological queries share a recent preview and an admitted history
boundary for windows, refill and rail ordinals. Verified route pages can extend
history. The follow graph and distinct non-owner signers govern Home of either
owner. A silent relay leaves its range owed. See [fetch orchestration](fetch-orchestrator.md) and the separate [signer lane](signer-orchestrator.md).

## Bounds and storage

The schema-3 Worker database is lkjstr-wasm. Verified compact event bytes carry
format-tagged receipts; older or mismatched rows still pass ordinary verification.
Startup restores a bounded metadata/deletion checkpoint before the newest 2000
event rows and before opening views. The checkpoint adds at most 4000 records
and 4 MiB of encoded bytes, including duplicates of event-store bodies.
Shared [durable GDSF](durable-cache.md) bounds disk rows and recovers required proofs.
Memory targets 16000 regular
and 4000 replaceable events and 64 MiB of managed allocation using [weighted retention](orchestration-optimizer.md).
The [compact resident store](compact-event-store.md) shares binary payloads with pending persistence.
See [cache-bootstrap.md](cache-bootstrap.md) for storage and verification bounds.

There are at most 128 views and 32 attached clients. Each visible view hydrates
up to 6000 authors. Shared profile requests chunk at 120 authors, or 60 under saturation.
Per-relay limits and deadlines bound socket work. A visible profile request may
pause another request, which resumes when a slot becomes available.

Windows accept 800 rows on either side; retainAbove caps retained history at 6000.
Visitor Global classifies a bounded slice of at most 6000 events. Signed-in feeds bypass its repeat and author limits.
See [hidden-note-visibility.md](hidden-note-visibility.md) for covered slots, expiry and missing-row evidence.
Secret keys remain inside Rust and storage except for the explicit backup action. Diagnostics contain no secret keys.

## Verification and hosting

web/ builds dist/, including the hashed real engine graph. The root quiet
release gates build that same product. web/scripts/serve.ts is the local static
preview with the production headers. The experimental lkjstr-host crate still
validates an older asset layout and is not the product preview server.
See engine.md, engine-package.md, frontend.md and hosting-needs.md.
