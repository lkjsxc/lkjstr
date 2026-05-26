# Storage

## Purpose

Storage docs define browser persistence ownership.

## Stores

- `workspaces`: workspace layout and tab state.
- `accounts`: account metadata.
- `localAccountSecrets`: raw local signing account secret keys.
- `notifications`: local activity records.
- `tweetDrafts`: durable Tweet drafts.
- `events`: cached Nostr events.
- `eventRelays`: event relay receipts.
- `eventTags`: searchable `e`, `p`, `q`, and `a` tag rows.
- `feedCursors`: feed paging cursors.
- `feedCoverage`: durable relay/filter/range coverage evidence and unresolved
  diagnostics for feed scans.
- `jobs`: persisted in-app job records.
- `cacheMeta`: cache status records.
- `tabStates`: durable tab snapshot payloads keyed by workspace, pane, and tab
  id. See [Tab Snapshots](#tab-snapshots).
- `settings`: settings overrides.
- `relaySets`: editable relay sets.
- `relayDiagnosticSummaries`: persisted relay diagnostic summaries.
- `relayInformation`: fetched NIP-11 relay information documents.
- `relayListSuggestions`: per-account NIP-65 relay list suggestions.

## Contract

Local signing secrets are stored in dedicated IndexedDB tables separate from
public account records. Raw local accounts use the local secret table. Account
listing APIs return public account metadata only. NIP-07 signing stays in the
browser signer boundary.

Passkey-protected local secret storage is not implemented. The security design
is documented separately before any passkey secret table is restored.

## Tab Snapshots

`tabStates` rows store JSON payloads captured when a tab loses focus:

| Field | Feed tabs | Tool tabs |
| ----- | --------- | --------- |
| `anchorEventId`, `anchorOffset` | Required when list had scroll | Optional |
| `scrollTop` | Fallback for plain scroll | Optional |
| `oldestCursor`, `newestCursor` | When runtime exposes cursors | — |
| `filterState` | Search query, profile section | Surface-specific |
| `composerText` | Tweet, inline reply drafts | When present |

Session-memory snapshots mirror the same shape for fast restore within
`tabs.inactiveRetentionSeconds`. IndexedDB snapshots survive reload and expired
session TTL.

## Cleanup

Optional quota-pressure event cache cleanup may prune cached events, event relay
receipts, event tag rows, feed cursors, and feed coverage affected by pruned
feed keys. Complete coverage rows compact sooner than dense, incomplete,
unresolved, or failed diagnostic rows. Cleanup must not prune accounts,
settings, relay sets, workspace layout, notifications, Tweet drafts, or
`tabStates` unless the tab no longer exists in the workspace.

