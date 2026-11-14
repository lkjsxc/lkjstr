# Status

## Purpose

Current engine cutover, verified behavior and explicitly unfinished variants.
The independent frontend owns web/ on web/next-20261114; it is not edited here.

## Engine contract (2026-11-14)

The engine mirrors the fetched frontend's protocol.ts and mock action/message
inventory. docs/protocol-additions.patch adds accepted public-key discovery,
separate relay configuration, heartbeat/detach/reconnect and quote errors.
The real Worker conformance gate derives validators from that TypeScript file;
it drives every current mock message kind, every action name and every source.
Shape conformance does not establish completeness of every semantic variant.

Implemented:

- Bounded cache-first windows, key patches, anchors, fresh counts, hydration,
  finished notes/media/quotes, per-client visibility and shared relay requests.
- Strict relay/server save validation with rejected on any bad address, replace
  semantics, preserved read/write tags, and retained unused relay rows. Relay
  configuration carries read/write/search independently of EngineConfig.
- NIP-07 correlated public-key discovery and exact-event signing with deadlines.
  Device accounts create/import/use/remove transactionally; local keys sign
  entirely inside Rust. npub imports remain read-only. Account state survives
  worker loss. No secrets appear in account rows or diagnostics.
- NIP-46 bunker connect/get_public_key/sign_event with NIP-44 authenticated
  envelopes, exact signed-event validation, durable device credentials and
  bounded, explicitly closed RPC sockets. Remote account removal deletes its
  local session credentials.
- Blossom uploads and NIP-96 discovery/multipart fallback, authenticated through
  the account signer; 20 MiB/four-upload bounds, bounded HTTP/deadlines, honest
  zero/completion progress and checked response hashes/URLs. No fake success.
- Public follow/mute/bookmark/profile/relay/server actions; public people-list
  addresses and naddr resolution; notification types, grouping and persisted
  seen watermarks. Local-key NIP-44 private people/bookmark/mute entries can be
  projected without altering signed events. Public edits preserve opaque data;
  private removals are refused instead of claiming success.
- SharedWorker heartbeat expiry/detach and reconnect signals; Web Locks plus
  BroadcastChannel dedicated fallback. Browser checks prove one socket across
  two pages and follower query reopening after leader loss. No leader lease.
- Compact event tuples with previous-format reads, committed/retried writes,
  newest-2000 indexed boot and physical pruning to 20000 after successful live
  writes. Retention remains bounded in memory independently of physical disk.
- HTML-free package and frontend Transport adapter; see engine-package.md.

## Mock answers not yet fully implemented

No current top-level mock message or action name is entirely unhandled. These
variants of messages the mock answers remain incomplete:

- open/list, open/mutes and open/bookmarks: extension/remote private-list
  decryption and encrypted-entry editing. A decrypt capability for NIP-07 is
  outside accepted A-D. Local NIP-44 projection works; historical NIP-04 does
  not. Refusing private removal avoids a false successful unmute/unbookmark.
- open/emoji: referenced NIP-51 emoji sets; the account's own emoji list works.
- open/search: matching people ahead of notes; NIP-05 query-reference resolution;
  multi-language OR currently uses only the first language. Note search works.
- account.add/key: NIP-46 auth_url interactive challenges and relay-switch
  negotiation. Preauthorized bunker sessions work; challenges fail explicitly.
- upload: NIP-96 delayed processing (202) polling, cancellation and intermediate
  byte progress; zero and committed completion are reported. HTTP failures and
  invalid responses fail explicitly. Other media protocols are unsupported.
- open/notifications: trusted LNURL-provider discovery for zap receipts is not
  integrated. Cached zap rows are lower-confidence receipt data; full trust
  validation is not claimed. Follow notifications reflect retained kind-3 events,
  not an unbounded historical follow/unfollow ledger.

Remaining scheduling work includes outbox-aware routing in the new scheduler,
coalescing and adaptive hints. Language heuristics remain English/Japanese
script detection. Repeated/suspension stress and complete privacy coverage are
not established by the finite conformance suite.

## Verification

The latest gate counts, artifact sizes and cold-start measurements are recorded
in engine-package.md, engine-performance.md and verification.md. Browser runs
use fresh ports/data, loopback WebSockets and intercepted HTTP only.
Docker Compose remains excluded by the explicit worktree-only write rule:
image/container storage is outside this worktree. No commit, deployment,
production access, CI edit or existing-service restart is performed.

## Retained application

The previous Leptos/Trunk app remains available. Historical UI/design results
in verification.md do not verify the new independent frontend. This change
contains engine, protocol, packaging and verification work only.
