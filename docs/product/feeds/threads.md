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
- Runtime caches reactions and reposts as thread metadata, not replies.
- Initial and older thread pages request `30` items.
- Thread tabs keep a `240` item window.
- Older replies load after near-bottom scroll or viewport auto-fill.
- Historical reply pages use the event tag index, compound `{createdAt,id}`
  cursors, local relay boundary filtering, and merged relay provenance.
- When older reply paging prunes newer replies, Thread exposes near-top newer
  recovery from the current newest cursor.
- Live relay reads set `since` when the thread runtime starts.
- Deep reply branches collapse into a continuation row that opens the hidden
  event in a matching Thread tab. Loaded thread chains keep capped indentation.
- Closing the tab closes relay subscriptions.
- Thread surfaces use the shared post renderer.
- Reaction chips are local disclosure toggles such as `<3 5`. Expanded details
  show compact actor avatars and names and expose `aria-expanded` with
  `aria-controls`.
- Cached reposts render as a compact repost chip/list when available.
- Thread row metadata does not show short event ids.
- Reply-root references can be omitted or shown only as neutral referenced
  events; they must not be labeled `Thread root`.
