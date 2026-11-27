# Keys and messages status history

## Purpose

This dated account is retained from [status.md](status.md); it does not claim new pinned-notes verification.

## Specified keys and messages (2026-11-16)

Protocol 8 implements Claude's K1-K4, M1-M6 and D1 specifications with the existing paired strings and design tokens. Conversation lists, older
private messages, one-to-one/group text, inbox settings and encrypted draft/failed-send recovery are reachable. Private bodies never enter public row
caches or ordinary layout storage. Lock coordinates registered editors across clients before revoking plaintext; an unresponsive or expired unresolved
editor prevents lock. The durable archive, signer and editor bounds are documented in [dm-drafts.md](dm-drafts.md), [dm-signers.md](dm-signers.md) and
[dm-editor-locks.md](dm-editor-locks.md). No group-subject/file/reaction/delete surface was added. Strict per-page unlocking remains a recorded K2 difference.

The 468 required width/theme/language captures were generated and reviewed. Fresh real-Worker UI checks passed 13 key and 16 message assertions,
including stable inbox discovery across relay-slot rotation. All seven required gates passed; evidence and limits are in
[interface-verification.md](interface-verification.md). Persisted browser-history pages now keep their editor lease and probe the connection on
resume. Returning pages probe before replacing their Worker, and expired sessions restore the keyed reading window in one snapshot.
Completed empty inbox evidence survives relay-slot rotation. Explicit stop revokes private rows, key/startup queues and projections, and closes all entry paths.
