# Threads

## Purpose

Thread tabs show a root event and replies opened from timeline event actions.

## Contract

- Thread tabs are not listed in New Tab.
- Event id comes from a timeline action.
- Runtime loads matching cached events first.
- Thread performs bounded initial relay reads for the focused event, root, and
  replies without `since`, then keeps live subscriptions bounded with startup
  `since`.
- Runtime subscribes for the root id and text notes referencing that id.
- Initial and older thread pages request `30` items.
- Thread tabs keep a `240` item window.
- Older replies load after near-bottom scroll or viewport auto-fill.
- Historical reply pages use the event tag index, compound `{createdAt,id}`
  cursors, and local relay boundary filtering.
- Live relay reads set `since` when the thread runtime starts.
- Deep reply branches collapse into a continuation row that opens the hidden
  event in a matching Thread tab. Loaded thread chains keep capped indentation.
- Closing the tab closes relay subscriptions.
- Thread surfaces use the shared post renderer. Visible event entity text is
  shown in full where identifiers are explicitly displayed.
- Reply-root references can be omitted or shown only as neutral referenced
  events; they must not be labeled `Thread root`.
