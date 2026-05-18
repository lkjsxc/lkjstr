# Threads

## Purpose

Thread tabs show a root event and replies opened from timeline event actions.

## Contract

- Thread tabs are not listed in New Tab.
- Event id comes from a timeline action.
- Runtime loads matching cached events first.
- Runtime subscribes for the root id and text notes referencing that id.
- Closing the tab closes relay subscriptions.
