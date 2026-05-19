# Threads

## Purpose

Thread tabs show a root event and replies opened from timeline event actions.

## Contract

- Thread tabs are not listed in New Tab.
- Event id comes from a timeline action.
- Runtime loads matching cached events first.
- Runtime subscribes for the root id and text notes referencing that id.
- Initial and older thread pages request `30` items.
- Thread tabs keep a `240` item window.
- Older replies load only after scrolling near the bottom.
- Historical reply pages use the event tag index and relay `until` pages.
- Live relay reads set `since` when the thread runtime starts.
- Closing the tab closes relay subscriptions.
