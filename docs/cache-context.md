# Durable read contexts

## Purpose

Preserve the verified bodies behind a previously read note and its counts.
An empty or partial startup store must not turn a held count into zero.
This follows [cache bootstrap](cache-bootstrap.md); it is not a claim that every
persisted view, private conversation or relay filter is fully cached.

## Selection and retention

Only current Reading anchors and at most 32 near-delivered public note IDs
select a context. The wire selector uses the same public-projection policy as
the pre-Worker row cache. Unknown, hidden, invisible and private-derived
selections cannot create a durable public membership index. The Engine checks
that the supplied IDs belong to the live visible view again after namespacing.

A context holds the target note body, its retained reply/ancestor graph,
direct reactions/reposts/zap receipts, and owner-signed deletion fences.
Grandchildren without a root tag are included because they affect reply counts.
Bodies live in the kv checkpoint, independently of the newest-event slice and
ordinary event-row pruning.

The checkpoint admits at most 256 targets, 8000 record occurrences and 8 MiB of
encoded UTF-8, including its envelope. Targets are considered by last observed
read time. Admission and eviction operate on whole contexts; a truncated
contributor set never becomes restoration evidence. Shared receipt bodies count
once per context in this disk budget. Historical provider identities have the
existing independent bound of 2048. Batch construction applies the remaining
record and byte allowance before capturing the next context, not only after
building every candidate. The transaction callbacks share one bounded batch.

Admitted bodies and deletion evidence form a bounded memory retention floor.
The default 16000 ordinary-event capacity can contain the complete floor.
A deliberately smaller Store capacity may retain more than its ordinary limit
while these pins exist. Explicit owner deletion still removes the event.
Retained deletion evidence cannot be undone by deleting its fence event or
overflowing the ordinary tombstone index. Removing a context releases its pins.

## Durable merge and restore

The existing schema-2 kv store holds `verified-read-context-v1`. No account
key, account revision or database schema changes. Older schema-2 code ignores
this key and may prune ordinary rows without deleting its independent bodies.

Events, metadata fences and contexts commit in one events+kv transaction.
Writers first read the current checkpoint inside that transaction, union
immutable contributor IDs, and remove only bodies covered by a verified
owner-signed deletion. A stale partial writer cannot overwrite a larger known
set or revive a deleted contributor. Failed transactions leave all new bodies
and authority uncommitted; the normal persistence retry remains responsible.

The checkpoint has a durable unsigned logical clock and random public epoch.
Each newly admitted target receives an opaque lineage. A changed contributor,
fence or historical-verdict basis advances its generation and token atomically.
A recency-only touch changes neither. Eviction followed by recreation produces
a new lineage, even for the same note ID. The clock persists in an empty
checkpoint. Malformed checkpoints fail closed on read; they do not establish
new authority for zero counts. The next context writer repairs a malformed
string or non-string value within the events+kv transaction using a fresh,
domain-separated epoch. An old rendered count cannot adopt that new lineage
as a same-context zero. Corruption does not permanently poison event writes.

Boot validates and pins complete contexts, restores their public bodies and
historical zap verdicts, and primes receipt candidates before opening views.
Metadata restores first; the ordinary newest 2000 rows follow these contexts.
A retained matching verification receipt avoids another signature check.
The receipt is a corruption/format boundary, not authentication against
arbitrary same-origin code. Embedded repost targets keep their existing checks.

## Counts contract

The additive `Counts.context` object contains `lineage`, `generation`,
`token`, `restored` and `current`. Its generation crosses the wire as a
canonical unsigned decimal string; consumers compare integers exactly.

- `restored` means the committed contributor bodies and recorded zap
  dispositions are present, or a newer owner-signed deletion explains a missing
  body. It does not mean all relays or all history are complete.
- `current` additionally means the rendered contributor/verdict basis matches
  that committed context. Pending public policy writes also prevent durable
  capture because reply presentation can depend on mute policy.
- New verified live data may render with `restored:true,current:false` while
  retaining the previous committed lineage, generation and token.
- A restored same-lineage generation greater than the held generation permits
  correction, including a smaller value or zero. Equal generations require
  equal tokens. Tokens establish equality and are never ordered.
- A different lineage cannot silently replace a held count basis. Explicit
  navigation may reset that association.
- Durable frontend capture uses a current committed model. It must not bless
  a newer live count with an older contributor token. The existing `partial`
  flag continues to mean observed relay truncation only.

Account-scoped counts add `context.selection`: account, optional public mute
ID and exact decimal creation time, a token binding that policy to the context,
and whether its exact current ID is committed. The bounded registry retains
128 accounts. Verified IDB restoration or a successful event transaction
acknowledgement establishes it; a late old acknowledgement cannot bless a newer
pending policy. Account removal forgets that registry entry.

Reply decreases require contributor authority plus the same selection, or a
new committed mute replacement ordered by timestamp and then lower event ID.
Absent or older policy never reduces a count held under a known policy. A
missing ID means currently unfiltered, not proof of policy removal. Old cached
counts without a selection basis remain conservative until explicit navigation.
Unrelated counts continue to use contributor and historical-verdict authority.

## Zap authorization

A positive zap value requires the previous fully checked historical provider
verdict, bound to the exact verified raw receipt. Its compact identity proof
retains the public recipient, provider, profile identity and endpoint. No
current HTTP response is invented after restart, and this proof cannot authorize
a fresh receipt. Anonymous/private attribution stays as its existing opaque
public classification; no decrypted private payload is stored.

Duplicate invoices can target different notes. The checkpoint includes the
retained canonical receipt and matching verdicts so restoring only one note
cannot inflate its zero total. Owner deletions correct the retained payment
set using the same durable merge.

An unresolved raw receipt may carry an explicit pending disposition. Reopening
restores the existing pending/unverified state rather than an empty-index ready
zero. Completion upgrades that disposition and advances the context generation;
a stale pending writer cannot replace a completed verdict. A missing or changed
verdict cannot establish the prior positive amount. A provider completion while
the first context transaction is in flight leaves that target dirty after its
acknowledgement; a later commit upgrades the first persisted pending verdict.

## Held public screen references

The additive `cache.hold` message contains at most 64 rows per subscription.
Each carries a stable key, optional top-level note event ID, at most 16 profile
references (`pubkey`, `id`) and at most 8 embedded note references (`id`).
Identifiers must be canonical lowercase 64-character hex. Invalid references
are ignored. A notification's terminal note belongs among embedded references,
not the top-level ID, so its deletion cannot erase a valid reaction row.

This ledger is separate from delivered rows. It never inserts or trusts a
frontend row model, count or claimed author. The existing public-cache policy
also gates held references. Close, identity reuse and private-policy revocation
release them. Only visible public projections schedule local reference reads.

The Worker tries at most 32 references and 4 MiB per batch from public stored
records, including bodies older than the newest 2000 startup rows. Every older unreceipted
row is signature-checked before it receives a trusted cache receipt. Encrypted
message, gift-wrap and signer-RPC kinds are excluded. An IDB error retries;
a successful missing lookup becomes a residual engine want, never completeness
or deletion authority. A namespaced registry replaces the whole current set,
releases close/hide/reopen/private revocation, and supplies exact-ID gaps to the
single planner. Its bound is 128 views and 1600 IDs per view.

`cache.reconcile` carries `removedKeys`, `invalidProfileIds` and
`removedQuoteIds` only after a signed deletion is bound to a verified original
author or a checked durable target context. A deletion request alone cannot
supply that binding. The proof ledger retains at most 4096 recent IDs; evidence
changes wake projections even when no new event is inserted. EOSE, eviction,
missing records and relay failures do not remove held rows or references.

## Earlier metadata migration

A schema-2 public metadata scan recovers older profiles and public list records
outside the startup slice. Each ID-ordered page visits at most 32 rows and keeps
at most 4 MiB, rejecting individual rows above 1 MiB. Only eligible older
metadata is signature-checked. Metadata commits precede the saved resume cursor.

Boot checks a three-second budget between pages and visits at most 626 pages;
each individual IDB operation has its own fifteen-second failure bound. Larger
or slower stores resume at the saved cursor on a later boot. The `done` marker
is written only after cursor exhaustion. A partial pass never proves absence.
Held screen references have the independent local hydration path above.
The secret-bearing account load and its abort/revision fence are unchanged.

## Remaining scope

The ordinary disk store still timestamp-prunes to 20000 rows. A stored public
body outside the newest slice can now hydrate lazily, but an already-pruned
body outside admitted contexts still requires relay retrieval. A frontend
snapshot alone does not establish backend evidence or full query coverage.

Full least-recently-seen retention, protected own events/followed profiles/
bookmarks, private conversation restoration, and durable per-relay/filter
coverage remain separate work. Public query-policy changes need a revocable
selection basis; immutable deletion evidence cannot represent unmute/re-add.
The additive count selection evidence handles committed public mute replacements
without asserting that all bookmark/follow membership is durably restored.

## Verification status

On 2026-11-17, 60 focused native cases passed, covering corruption recovery,
cumulative batches, the first zap commit, held-reference deletion authority,
private-policy release, committed mute replacement and verified older metadata.
Reference ownership, strict native and WASM Clippy, and repository checks pass.

The browser transaction/restore proof and combined release gates have not run
for this integration. No deployment or measured context-cache gain is claimed.
