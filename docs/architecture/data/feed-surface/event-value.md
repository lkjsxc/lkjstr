# Feed Event Value

## Purpose

Feed event value defines which received events may become visible rows and why
they deserve short-term runtime or cache retention.

## Visible Row Contract

- Feed rows are display-bound before they enter a page result or live window.
- Future events are stored for cache/protocol completeness but are not inserted
  into visible feed rows.
- Local display filtering enforces `since`, exclusive `until`, compound
  `before`, and compound `after` after relay over-fetch.
- Compound cursors use `{ createdAt, id }`; older pages keep events below the
  cursor and newer pages keep events above the cursor.
- Relay scan segment bounds are enforced at dispatch and by local display
  filtering for segment reads.
- Profile live rows must also satisfy the runtime `since` bound. Old live
  replays and future events may be stored, but they do not move the profile top
  window.

## Runtime Value

- Visible and near-visible rows are dynamically pinned by the owning tab while
  the list exists.
- Open-reference pins are owned by the consumer that needs those references.
- Runtime pins are unioned during compaction and cleared by owner teardown.
- Runtime pins are not persisted into `eventPriority.protected`.

## Retention Value

- Durable hard protection is limited to explicit hard-protected records and the
  latest metadata/follow-list classes described in retention docs.
- Retention score is a derived value from recency bucket, kind weight,
  structural source tags, and direct target bumps from replies, quotes,
  reposts, reactions, and zaps.
