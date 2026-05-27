# Bootstrap and Live Tail

## Purpose

Every feed-like surface splits relay loading into a short bootstrap read and a
separate live tail. This follows NIP-01: `limit` bounds only the initial query;
live subscriptions must not reuse bootstrap filters without a forward `since`
anchor.

## Bootstrap Phase

| Property | Value |
|----------|-------|
| Demand `phase` | `bootstrap` |
| Pool strategy | `backward` |
| `limit` | Surface page size (`30`) or adaptive segment cap |
| Close triggers | `EOSE` on all active relays, event cap, timeout, abort, terminal relay state |
| Kinds | Feed-renderable notes only unless runtime doc names an exception |

After bootstrap:

1. Merge accepted events into shared storage once.
2. Materialize the in-memory window for the surface.
3. Record `newestCursor` for live anchoring.
4. Close the bootstrap Lease before opening live.

## Live Phase

| Property | Value |
|----------|-------|
| Demand `phase` | `live` |
| Pool strategy | `forward` |
| `since` | Newest accepted event `created_at`, minus `30` s skew |
| `limit` | Omitted on live filters |
| Close triggers | Zero visible owners, runtime close, relay disable |

Live Demands open only after bootstrap completes or cached cursors prove a
non-empty window. Empty bootstrap with confirmed exhaustion may skip live until
the user changes filters or relays.

## Page Phase (Older / Newer)

- Demand `phase` is `page`.
- Uses `backward` with explicit `until` or `since`/`until` windows from runtime
  private scan cursors.
- Always one-shot; never left open after `EOSE`.
- Dedupes in-flight identical page Demands through the subscription manager
  read dedupe key (fingerprint-based).

## Reattach After Hidden Tab

When a tab becomes visible again within `stalenessMs` (`120_000` ms default):

- Reattach the live Demand with the same `since` anchor if the cursor is still
  the newest stored event for that surface key.
- Skip bootstrap unless the in-memory window was evicted or relays changed.

When stale or relay set changed:

- Run bootstrap again, then live.

## Failure

- Bootstrap failure surfaces through runtime status strings and Log diagnostics.
- Partial bootstrap may still open live from the newest accepted row.
- Live failure does not discard cached bootstrap rows.
