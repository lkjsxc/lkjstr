# Diagnostics

## Purpose

Diagnostics define browser-visible operational signals. The browser is the
runtime, so failures must be inspectable without server logs.

## User-Visible Signals

- relay connection state.
- publish outcome per relay.
- subscription count per relay.
- cache health.
- signer availability.
- relay parse failures.
- send queue overflow when a relay socket has not opened.
- app heap and runtime feed counters during heavy-feed smoke tests.
- persisted relay attempt, success, failure, last-connected, and last-error
  evidence where relay settings record it.
- persisted relay summary counters, last event id, first-message latency, EOSE
  latency, validation counters, and bounded recent relay diagnostics.
- structured read-page status with EOSE, timeout, CLOSED, AUTH, socket
  closed/error, duration, candidate count, and final event count.
- `relay-feed-incomplete` warnings use detailed read-page statuses when
  present. `missing-status` means no detailed status was available for that
  read.
- Dense cap-limited feed windows record coverage metadata with
  `reason: event-limit` and keep conservative paging, but expected dense cap
  stops do not add `relay-feed-incomplete` log rows.
- Late `EVENT` messages for locally closed subscription ids are ignored after
  successful event verification. They are not true unknown-id diagnostics.
- persisted job health derived from stored jobs, including status counts,
  root-job counts, oldest queued age, latest failure, and latest stale startup
  mark.

Timeline surfaces keep low-level diagnostics out of the feed body. Home and
Global may show high-level state errors, while detailed diagnostics are
inspected in the New Tab `lkjstr Log` surface.

lkjstr Log is current-session browser state only. It shows timestamp, area,
severity, code, message, and redacted context, and it is cleared by reload.

lkjstr Log presents diagnostics as one chronological stream. Relay diagnostics
use `area: relay`; runtime, storage, signer, cache, and subscription failures
use the same surface. Message and context fields wrap within the tile.

Repeated identical relay diagnostics are throttled in the app log for
`10` seconds by relay, subscription id, kind, and message. The first row is
shown immediately; suppressed repeats are counted, and the next visible row
adds a bounded `repeats suppressed` suffix. Relay snapshots and relay session
counters still record the raw behavior.

Runtime lifecycle diagnostics include tab id, runtime kind, relay count, close
reason, uptime, item count, and subscription counters when the owner exposes
them. These records are local app-log entries and do not persist across reloads.

Relay parse diagnostics include measured bytes when available for unsupported
binary or non-text frames and include size plus limit for oversized text
frames. Diagnostics do not store raw relay payloads.

Stats and Relay Settings show persisted relay and job summaries. Stats also
shows compact runtime memory counters. They must not duplicate lkjstr Log rows
or expose raw logs, relay payloads, event arrays, subscription ids, tab ids, or
request ids.

Clean-browser Playwright is the source of truth for app-origin console
diagnostics. Suppression is limited to the external `lockdown-install.js` plus
`SES_UNCAUGHT_EXCEPTION` plus null payload case.

## Diagnostic Events

Diagnostic events are local app records, not Nostr events. They are kept in a
bounded session log and are not persisted by default.

Each record contains:

- timestamp.
- area.
- severity.
- code.
- message.
- context without secrets.

## Severity

- `info`: expected state transition.
- `warn`: degraded behavior that still allows work.
- `error`: failed operation requiring user or app action.

## Privacy Rules

Diagnostics must not record private keys, full draft bodies, signer secrets, or
unredacted external signer payloads. Event ids, relay URLs, public keys, and
typed error codes are acceptable.
