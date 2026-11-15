# Owner audit, 2026-11-15

## Purpose

The current browser application was audited at desktop and phone widths,
with mock and real Worker engines. Historical bundles af8c915e and dbd66e59
are built under ignored tmp/history, visited, signed into with a fixture
extension, customized, and upgraded on the same origin and browser storage.
No production changes, CI edits, commits or deployments are part of this job.

## Repairs

- A one-time UI storage migration replaces only untouched historical defaults.
  Random pane IDs are copied into the historical template before requiring
  serialized equality. Custom sizes, active tabs and arrangements survive.
- Retired About and Shortcuts tabs become individual Docs pages in their
  original positions. Existing Docs state and closed tabs are preserved.
  Saved static labels are discarded in favor of current translations;
  previous day/week filters become start-day filters without dropping the query.
- Tab search ranks an exact view name ahead of another view's description.
  Searching Relays previously chose Global because its hint mentions relays.
- Accounts and muted-people avatars open profiles, separately from account
  switching and mute removal.
- Paging requests now send the protocol 3 retainAbove flag. The previous
  800-row window removed rows already read. The existing engine retains up
  to 6000 cached rows above the anchor; no rail or scrolling files changed.
- Ordinary posts and replies use the bounded retained-draft outbox previously
  used only for channels. The field clears synchronously and delivery remains
  visible. Failed drafts preserve attachments, author and retry controls.
  Pending operations survive remount without overwriting the next draft.
- Account and Settings lists fill the tile; sign-in and add-entry controls
  keep their own measure.
- Screenshot servers bind a free port instead of choosing a random fixed port.

## Evidence and commands

Run web check, build and smoke as usual. LKJSTR_SHOTS=1 adds audit-NN captures
at 1440 dark and 390 dark to tmp/screens. Both smoke and smoke:real drive the
shared audit checks; all publications go only to the loopback relay fixture.
The deeper real-engine regression traverses more than 800 signed notes and
checks that the first row is retained before returning to the top.

Build historical bundles with git archive into tmp/history/<revision>, using
worktree dependencies, then run node web/scripts/audit-returning.mjs against
the current mock build. It writes the four returning browser states there.
Subsequent mock smokes also exercise the full audit over those saved states.
Historical assets, browser state, JSON evidence and gate logs stay in tmp/.
The real-engine upgrade check additionally builds each historical WASM package
and runs node web/scripts/audit-returning-real.mjs against the current real
build. Those upgrades retain the actual old IndexedDB and HTTP cache, verify
Home after two reloads, and publish nothing.

## Known incomplete work

The public-relay sample uses the public example identity from NIP 19, imported
as read-only. It loads real Home notes, the account's own NIP 65 relays first,
and posts, replies, reposts, reactions and media on its profile. No public
publication or signer is involved. Channels discovery returned no rows during
the sample. The loopback channel UI works, but that is insufficient evidence
for public discovery; item 15 remains open.

Stats exposes real counts and errors but not the requested fetch purposes.
One public relay reported excessive requests. Item 11 remains open, including
that orchestration concern. These require engine follow-up, not invented UI
success. Rail items 28 and 29 belong to the separate rail job.

Repeated curl HEAD requests to the live site timed out, so deployed cache
headers could not be established. Current build output already hashes the
entire worker/WASM graph and registers no service worker. Whether a returning
browser can reuse stale index.html depends on the unverified host headers;
the build cannot replace those headers. Do not infer live cache freshness
from the local preview server's no-cache policy.

The detailed verdicts and the short Japanese owner note are in the ignored
files tmp/audit-report.md and tmp/audit-note.txt. Docker Compose is excluded
by the instruction allowing writes only within this worktree.
