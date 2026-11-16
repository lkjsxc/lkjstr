# Zap engine

## Purpose

The protocol-9 integration adds provider discovery, authorized receipt projection
and explicit unpaid invoice preparation. Native policy, Worker wasm32 clippy,
frontend checks and 40 real Worker fixture checks pass; full gates remain pending.
The existing zap control remains unavailable until Claude specifies its surface.
There is no wallet call, payment action or publication of a kind-9734 request.

## Trust and amounts

A trusted row is a provider-authorized receipt, not independent evidence that
a Lightning payment settled. The recipient's verified kind-0 lud16/lud06 metadata
selects an HTTPS LNURL endpoint. Its fresh, bounded response authorizes the
receipt signer through nostrPubkey. Receipt/request signatures, BOLT11 signature,
amount, exact description hash, recipient and signed target/split membership
must agree before an amount or identified actor reaches counts or notifications.

Duplicates share (provider, recipient, payment hash). The oldest valid receipt,
then lexicographically smallest id, is canonical across targets. A second event
or changed target cannot count the same provider attestation twice.

Exact millisatoshis are summed with u128 and exposed as a decimal string.
Numeric Counts.zaps is the summed amount divided by 1000, rounded down and capped
at 9007199254740991. zapLimited is true for either fractional rounding or capping.
zapState/zapUnverified describe unresolved trust separately from Counts.partial,
whose existing relay-page truncation meaning is unchanged. The existing number
control uses its existing plus suffix for incomplete trust or numeric precision.
A zero count remains blank.

Successful authorization retains its original metadata id, endpoint, provider
key and observation time across later provider rotation while the receipt stays
retained. Newly seen old receipts cannot borrow that observation. Historical
HTTP proof is session-only: reload reauthorizes current providers; receipts from
a rotated-away provider remain unverified without their earlier authority.
Signed receipt events remain ordinary persisted events.

## Protocol

Exact additive fields are recorded in [engine-proposals.md](engine-proposals.md).
Target is {k:"event",id} or {k:"profile",pubkey}.

- zap.quote {req,query:{target,amountMsat?}} returns provider/split evidence.
- zap.receipts {req,query:{target,before?,limit}} returns at most 200 trusted rows.
- zap.close {req} releases a finite read or cancels an explicit invoice.
- zap.invoice {as,intent:{target,amountMsat,comment}} returns result.zapIntent.
- The intent is {state:"unpaid",target,amountMsat,invoices}; no payment is inferred.

A receipt row contains id, createdAt, target, sender, recipient, provider,
amountMsat, verification, recipientProfile, providerEndpoint, providerObservedAt
and verifiedAt. verification is "provider-authorized". sender is
{k:"public",pubkey}, {k:"anonymous"} or {k:"private"}; anonymous/private outer
request keys are not identified payers. Private comments are not exposed.
Display times use milliseconds; the opaque receipt cursor uses seconds.

Receipt coverage distinguishes an observed relay page, truncation, failure and
loading. It does not certify all network history. The cursor traverses retained
verified receipts; it does not page relays. Existing counts and notification
actors share the same validated, globally deduplicated view.

## Notifications and Seen

SubState.zapEvidence and Account.unreadZap describe unresolved receipt authority
separately from the existing relay phase. Failed/unsupported provider discovery
does not certify empty zap history. A successful later lookup invalidates quiet
rows and account unread projection. Existing state wording is reused.

Seen snapshots unresolved receipt IDs together with the ordinary watermark in
the same account transaction. Later authorization of an older candidate can
therefore make it unread even after a newer ordinary notification was seen.
Repeated Seen calls retain unresolved candidates without blocking ordinary Seen.
Acknowledgement is by provider/recipient/payment hash, including raw aliases;
canonical receipt eviction cannot re-count an acknowledged logical payment.
Exceptions survive account persistence and Worker restart.

There are at most 6000 deferred IDs and 6000 logical payment acknowledgements per
account. Overflow sets readLimited and keeps conservative unread evidence; it
never silently certifies forgotten exceptions as read. Old acknowledgements
may leave this bounded history, with the limit remaining explicit.

## Invoice lifetime

Quotes never sign. An explicit invoice preflights every signed split recipient,
then asks the selected local, extension or bunker signer for exact kind-9734
requests. The requests go only in HTTPS callback parameters. They never enter
the event store, relay EVENT frames or a wallet.

Signed request JSON is canonicalized once and is the exact byte string committed
by the callback nostr parameter and BOLT11 description hash. Invoices must be
mainnet, correctly signed, match the allocated amount and remain unexpired.
All split invoices return together; a failed recipient produces no partial
invoice result. Mandatory payer-data requirements and encrypted success actions
are unsupported. Returned message/URL success actions are inert data.

Ownership lasts through queued terminal delivery. Lock, removal, replacement,
close, detach and deadline invalidate work; late signer/provider/HTTP responses
cannot revive it. Completed but undelivered intents are checked again for
deadline, invoice expiry and recipient metadata changes. Duplicate active request
IDs are ignored for one client; the same ID on another client is independent.
Before initial engine readiness, cancellation removes a queued invoice before it
can reach any signer. A live cancellation waits for its owning Worker result.

## Bounds and scheduling

- 512 cached recipients, four provider HTTP jobs, 15-second core deadlines.
- Provider evidence lasts 600 seconds; failed discovery retries after 60.
- Never-attempted providers precede retries; explicit quote/invoice demand takes
  the next free slot without cancelling already running background requests.
- 16 finite queries, four invoices and 64 reserved owner/terminal slots.
- Queries end after 20 seconds; complete invoice ownership ends after 90.
- Client watchdogs close lost queries at 25 seconds and invoice actions at 95.
- Pre-ready finite reads own at most 16 immutable 4 KiB UTF-8 JSON snapshots;
  reconnect fails started reads rather than replaying old authority.
- Target plans cap at 1024; four target signatures are checked per pump.
- Receipt verdicts cap at 20000; four cryptographic checks are made per pump.
- Historical provider identities are interned with a 2048-entry bound.
- Provider/callback bodies cap at 64 KiB, with credentials omitted, no referrer
  and redirects rejected. Callback URLs cap at 32 KiB.
- Split recipients cap at 32; weights use exact decimals with at most nine
  fractional digits. Largest remainders preserve the total millisatoshi amount.
- Passive current-reading demand caps at 800, with a separate 200 badge targets.
- Each visible view considers its current reading anchor plus 60 rows either
  side, with at most 128 distinct row/quote targets; old clients use the window
  anchor. `reading {sub,key}` accepts only that subscription's delivered key.
- Per-view/account turns deduplicate before admission. Unfinished nearby work
  retains its slot; settled slots rotate. Hide/close releases its ownership.
- Badge discovery considers 200 recent receipts for each of at most 32 accounts.

Missing target/profile evidence uses ordinary bounded relay discovery. Provider
HTTP starts only for visible counts, saved-account badge evidence or finite
explicit demand. Hiding/detaching the last demand releases pending HTTP work.
Public-network behavior, long-lived receipt workloads and provider interoperability
still need measurement; intercepted fixtures cannot establish those claims.

## Verification

At 2026-11-16 12:19:08 UTC, load 1.51 / 1.83 / 1.76, the integrated native run
passed 63 cases (58 policy, three persisted Seen and two runtime). Compile and
tests took 14.090 seconds; the Worker wasm32 check took 12.741 seconds.
Records: tmp/zap-first-slot.json and tmp/zap-first-{native,wasm}.log.

The startup-cancellation regression failed in four cases on the preceding
transport. Eight finite-read startup/reconnect cases and two byte/snapshot cases
also failed before their fixes; all 36 combined transport cases passed at
12:38 UTC, load 1.74 / 1.96 / 1.97. Records: tmp/zap-read-{proof,final}.json.
The subsequent target-index run passed 65 native cases. Its projection workload
fell from 462.144 to 23.566 ms per 800 totals. Seven admission/reading cases and
strict core/NIPs/Worker clippy passed after the independent reading hint.
All 39 transport cases and full frontend `pnpm check` now pass.
Dates, load averages, before proofs and limits are recorded in
[engine-performance-zaps.md](engine-performance-zaps.md).
The finite real Worker harness passed 40/40 checks at 13:23:53.643-13:24:57.791
UTC, load 2.61/2.13/2.03 to 1.16/1.80/1.92. It covers all three signer kinds,
trusted counts/actors, exact invoice commitments, refusal, cancellation, lock
revocation and an elapsed 60018 ms signer timeout. All replies match protocol 9;
there were no page errors. Package SHA-256:
6fddfd66b854e89c3e3bf2b0c199ef78dccb499c47e7c4fe1abd6fee8f9d6dce.
Report: tmp/zap-harness-20261116-02/report.json, SHA-256
27eb3255088b1e6f11de58c47fa54870eef984472c6b9ea32ce12010c01de61d.
The first runner omitted the fixture getPublicKey answer and timed out during
setup; its failed report is retained in tmp/zap-harness-20261116/report.json.
Full integration gates remain pending. No public relay, owner account or payment
was used. All owned browser/server/helper processes were closed.

Primary references:
https://github.com/nostr-protocol/nips/blob/master/57.md
https://github.com/lnurl/luds/blob/luds/06.md
https://github.com/lnurl/luds/blob/luds/09.md
https://github.com/lnurl/luds/blob/luds/12.md
https://github.com/lnurl/luds/blob/luds/16.md
https://github.com/damus-io/dips/blob/master/03.md
