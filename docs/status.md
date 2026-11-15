# Status

## Purpose

Current engine behavior and unfinished variants.

## Protocol 4 channels (2026-11-15)

Protocol 4 channels use the existing store, signer, scheduler and paging for
creator-only metadata, messages, joined lists and unread marks. Channel messages
stay out of ordinary feeds. Early edits wait for the joined list; Stats and
client-tag settings use the real engine. Opened targets retain discovery capacity.
Channel work rotates alongside feeds. The UI tracks discovery phases and retains
full failed drafts for retry. Separate metadata requests protect busy channels;
repost filters accept kinds 6 and 16. Native and UI checks: [channels.md](channels.md).

## Protocol 3 integration (2026-11-15)

Protocol 3 added rich note filters including all-word
text, exact phrases, exclusions, image/video/link requirements, author unions,
known-profile names and bounded verified NIP-05 query lookups. Millisecond date
bounds round inward to Nostr seconds. Inclusive end dates follow local calendar
days across daylight-saving changes. Hide-reposts checks wrappers before resolving
target content. Home/Global can mix notification rows;
profile kinds project posts, replies, reposts (6/16), reactions and image/video
notes. Ordinary windows accept 800 rows on either side; retainAbove remains
bounded at 6000. Existing account discovery adopts verified NIP-65 relay lists.

## Owner feedback (2026-11-15)

Account discovery follows active signers independently of account views, retains
indexer/hint lookups after NIP-65 adoption, follows updates and falls back to
kind 3 relay JSON. Separate per-kind requests handle max_limit=1; settled
discovery yields to feeds and unfinished discovery on single-slot relays.
Authored events default to the lkjstr client tag; clientTag
can disable it. Blossom defaults respect kind 10063; NIP-96 remains a fallback.
Additive stats, retained windows and cached rowAtTime lookup are implemented.
Bounds, counter meanings, conformance and limitations: [owner-feedback.md](owner-feedback.md).

## Frontend integration (2026-11-15)

Release candidate, gates and UI gaps: [integration-release.md](integration-release.md).

The TypeScript app can build against the real SharedWorker adapter with
pnpm build:real in web/. Its full engine graph has immutable hashed URLs.
The frontend owns saved/bootstrap relay choice; verified owner NIP-65 lists
then take over. Search-only relays receive requests independently of ordinary read usage. Thread focus and decoded profile deep-link headers
cross the wire correctly. Native integration regressions cover these
projection and relay policies. Thread rows distinguish ancestors from the focus
and descendants; reply depth follows parent links before filtering/windowing.
Sibling branches are not projected as replies to the focus.

Quote lookup errors now have English/Japanese failure text, with a rendering
regression test. Two native thread regressions cover ancestors, nested replies,
root-only replies, missing parents, filters, windows and public references.
Accounts can be created/imported through the Accounts tab. Protocol 2 supports
explicit local nsec backup; external signers and read-only accounts refuse it.
Secret-bearing input/output debug representations are redacted.

The conformance gate now uses this worktree's contract, without fetching a
branch. See engine-package.md for commands and current verification artifacts.

## Engine polish (2026-11-15)

Visible windows batch up to 6000 authors per view, including nested quotes,
reply context and repost actors. Profile batches share relay work, prefer
note-delivering read relays, fall back after completion and release on hiding.
Cached names render immediately while metadata refreshes. Visible profiles
can preempt occupied relay slots; interrupted feeds resume after lookup.
Interrupted pages replay their original filters until EOSE. Completed page
coverage and cursors survive live resumption, so profile lookup cannot falsely
exhaust history. Four native regressions cover interruption and pagination.
Six native regressions cover routing, batching, context, refresh and release.
The delayed loopback probe uses 240 ms responses and congested slots: baseline
note-to-named-row 1893.7 ms; revised 232.5 ms. engine-check includes this probe.

Protocol 2 uses absent profile fields for unknown counts and the existing
partial flag for lower bounds. Count requests are bounded and exact only after
successful, untruncated, verified replies. No alternate estimate shape remains.
Signed-out relays.save with an empty account is supported by the Worker and
confirmed edits are saved by startup plumbing. The Settings action guard still
blocks visitor edits before they reach the engine; the frontend must remove
that guard specifically for bootstrap edits.

Signed-out Global defaults to deterministic window filtering: three notes per
author, ten-minute duplicate bursts and no-profile rows only after successful, untruncated lookups.
Windows refill across withheld rows; empty windows advance history themselves.
EngineConfig.signedOutGlobalFilter disables it; signed-in feeds are untouched.
The manual read-only sample held 65/200 rows: 33 author cap, 30 no profile and
two duplicates. Ten examples and owner decisions: [engine-polish.md](engine-polish.md).

## Engine contract (2026-11-14)

The engine mirrors frontend protocol.ts, currently protocol 5, including
cache-wide [time rails](time-rail.md), month counts and ordinal window seeks;
bounded generation snapshots progress during live ingestion and reject changed membership.
Earlier additions include key discovery, relay configuration, heartbeat,
detach/reconnect and quote errors. Conformance validators drive each mock message, action
and source. Shape conformance does not establish every semantic variant.

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
  private removals are refused instead of claiming success. Decrypted entries
  also govern feed/notification hiding, profile mute flags and nested quotes.
- First follow/mute/bookmark edits can create a list after successful,
  untruncated owner lookups confirm absence; pending, refused and unverified
  results remain protected. Search selects its best two eligible read relays.
  Replacing a bunker signer clears its durable remote credentials.
- SharedWorker heartbeat expiry/detach and reconnect signals; Web Locks plus
  BroadcastChannel dedicated fallback. Browser checks prove one socket across
  two pages and follower query reopening after leader loss. No leader lease.
- Compact event tuples with previous-format reads, committed/retried writes,
  newest-2000 indexed boot and physical pruning to 20000 after successful live
  writes. Retention remains bounded in memory independently of physical disk.
- HTML-free package and frontend Transport adapter; see engine-package.md.

## Mock answers not yet fully implemented

Some variants of implemented mock messages remain incomplete:

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

Publishing now plans 12 author outboxes plus eight inbox/context routes, retries
through a deadline and reports success on first acceptance. Missing recipient
lists are looked up; bounded persisted receipts route deletes after reload.
All saved accounts refresh profile/follow/relay/mute/server records independently
of cache. Read routes retain page evidence; Stats aggregates publication history
once. Full outbox two-cover, persistent backoff, focus and weights remain deferred.
Exact bounds, measured costs and remaining design: [orchestration.md](orchestration.md).

## Verification

Gate counts and cold-start measurements: engine-package.md, engine-performance.md
and verification.md. Audit repairs/open gaps: [owner-audit.md](owner-audit.md).
Browser runs use fresh ports/data, loopback WebSockets and intercepted HTTP only.
Docker Compose remains excluded by the explicit worktree-only write rule:
image/container storage is outside this worktree. No commit, deployment,
production access, CI edit or existing-service restart is performed.
Branch review covers first-list guards, eviction, search, signers and mute policy.
Earlier branch review passed four quiet gates and 53 local browser checks using
the then-fetched contract. Report: tmp/engine-harness/report.json.

## One product

web/ is the only interface. crates/lkjstr-engine-worker owns the Worker and
its browser effects; the root Cargo.toml is a virtual workspace. The Leptos
UI/runtime, root HTML entry, exclusive styles/icons and browser drivers are
removed. Shared static icons and the loopback relay helper remain in use.
Root build and quiet release gates build web/ with the real engine. No Trunk
installation is needed. Docker configuration follows that build but cannot
be run in this environment. Historical UI results do not verify this product.

Review regressions cover nonnegative numeric counts, filtered-window refill,
anchorless history fetches, and refused, timed-out or truncated profile lookups.

## Signer conformance follow-up (2026-11-15)

The harness now exercises account.key backup, external-signer refusal and
missing accounts; backup payloads are redacted before failure diagnostics.
Real-engine signer checks inject NIP-07 before load and exercise rejection and
real 60-second deadlines for discovery/signing, with navigation and draft checks.
A shared loopback NIP-46 fixture checks optional/required connect tokens, signing,
reload credential reuse, refusal, disappearance during signing and recovery.
Remote RPC failures retain signer-refused versus signer-missing; losing all RPC
sockets now fails immediately and releases sockets instead of waiting a minute.
