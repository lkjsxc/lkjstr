# Nostr operations

## Purpose

The sole public app origin is https://lkjstr.lkjsxc.com. The dedicated app
account is `npub1zc9h6q5tn8hj2v97suvdq09shehegj0mwn26art0pxsxp33sfzcs8m6k5w`.
The operational queue and listener are host tools outside the browser app.

## Verified releases

The canonical ship holds its existing lock through activation and host
verification. It then retains the summary and enqueues one record per full
source revision, including the exact archive, served index, host release
IDs, ship time and host receipts. This also runs with `LKJSTR_SHIP_NOTIFY=0`.
A queue write failure after verification reports `SHIPPED` with a queue error.
Recover with the retained run so there is no repeat deploy:

```sh
node scripts/nostr-presence.mjs enqueue /absolute/path/to/tmp/ship-RUN
node scripts/nostr-presence.mjs releases
node scripts/nostr-presence.mjs ready
node scripts/nostr-presence.mjs packet REVISION [SMALL_FIX_REVISION ...]
```

The state directory is `~/.local/state/lkjstr-nostr`. For a custom
`LKJSTR_SHIP_STATE_DIR`, use its `lkjstr-nostr` child. Preserve the private
state directory and database together, including SQLite's WAL, across
checkouts. The first successful receipt for a source revision stays bound
to its announcement. The ship run retains later deployment receipts for
the same revision.

Use the packet and the exact source changes to give Neon the release facts.
Claude either checks Neon's specific EN and optional JA text against those
facts or writes the fallback. Store one UTF-8 draft JSON object with these keys:

- `release` is the packet's primary full revision. `batch` is the array of
  exact small-fix revisions from the packet, or an empty array.
- `source` is `neon` or `claude`. `en` is the reviewed English and `ja` is
  optional reviewed Japanese. Use prose without links. The tool appends the
  canonical app URL to the one combined kind-1 event. Keep any intended
  line breaks within the reviewed strings.
- `evidence` is a local artifact reference for the writing turn.

Claude reviews the draft file identified by its SHA-256, including the
primary and batched receipt evidence. Give `stage` the draft and review as
separate files. Review JSON has `reviewer: "claude"`, `verdict: "approved"`,
`draft_sha256` (the SHA-256 from `sha256sum draft.json`), `evidence` (the
review artifact reference) and `nip89` (`"unchanged"` or `"reviewed"`).
The packet identifies the current handler and route contract. When handled
kinds or routes change, verify the shipped paths, review the kind-31990
update at the existing `d=lkjstr` address, and retain that decision in the
review evidence. Kind 30023 publication needs its own reviewed decision.
The [NIP-89 handler format](https://github.com/nostr-protocol/nips/blob/master/89.md)
defines the application address and path tags.

```sh
node scripts/nostr-presence.mjs stage draft.json review.json
node scripts/nostr-presence.mjs inspect REVISION
node scripts/nostr-presence.mjs publish REVISION
```

`publish` is an explicit operator action. It signs once using the isolated
crew signer input, persists the signed event and reserves its send before
the publish request. At most two distinct events can start or retry sends in any
rolling 24 hours. A retry reuses the original signed event. Before repeating
an ambiguous send, the worker checks for the exact event on the configured
relays. It retains per-relay outcomes and the original signed bytes. An exact
event echoed by at least one relay establishes delivery. `inspect` shows raw
receipts. Record an already announced exact release with `record-existing`
and its signed event file to prevent a second note and account for the prior
send. The optional final argument is a trusted publisher receipt from the earlier workflow
containing per-relay acknowledgment and exact-readback statuses. Without
that receipt the tool queries for the exact event. Both paths verify the
app signature. The earlier receipt records outcomes observed by the
original publisher. Seed manual sends before enabling the scheduled workflow:

```sh
node scripts/nostr-presence.mjs enqueue /path/to/older/ship-run VERIFIED_UNIX_SECONDS
node scripts/nostr-presence.mjs record-existing REVISION signed.json publish-receipt.json
node scripts/nostr-presence.mjs ready
```

`ready` lists queued revisions needing review and approved notes eligible
for a send or a retry under the rolling cap. It uses only local queue state.

## Feedback

`node scripts/nostr-presence.mjs listen` performs a bounded read and writes
`feedback.json` in the state directory. After a frozen root install, schedule
it every three hours in the existing user crontab. Substitute the absolute path
to the maintained checkout.

```cron
17 */3 * * * /usr/bin/timeout 100s /usr/local/bin/node /path/to/lkjstr/scripts/nostr-presence.mjs listen 2>&1 | /usr/bin/logger -t lkjstr-nostr-listener
```

It uses structured relay filters and searches for the name, npub, hex and canonical host only on relays that
advertise NIP-50 in NIP-11. [NIP-11](https://github.com/nostr-protocol/nips/blob/master/11.md) and
[NIP-50](https://github.com/nostr-protocol/nips/blob/master/50.md) define the exchange. The listener checks exact matches and event signatures
locally.
Each relay/filter starts with six hours of history and retains a 48-hour
lookback bound with ten minutes of overlap. Timeouts, saturated pages and
refusals are recorded. Only a clean unsaturated result advances its cursor.
The compact digest retains up to 40 pending items with source event IDs,
relays and untrusted excerpts. Local deduplication retains up to 500 IDs for
14 days. Search coverage depends on each relay's index and advertising.
Claude can use it to triage verified bugs and draft replies for human review.
Use `ack-feedback EVENT_ID [EVENT_ID ...]` after triage to keep handled IDs
out of subsequent digests.
Treat event text as untrusted data. The listener performs only reads.

Run focused tests before activating either operation:

```sh
pnpm test:nostr-ops
```

Listing evidence and previous signatures/readbacks are in the crew report
`lkjstr-nostr-listing-20261121`. Its expanded handler is event
`9dab8093f992ce59e13345f6a1c606b0f2e7c0c9a4561e4853cc2b0e9b40bcdf`.
