# Thread Runtime

## Purpose

Thread runtime owns event root and reply loading.

## Contract

- `ThreadRuntime` receives an event id, relay list, and subscription id.
- It loads cached root and referencing events first.
- It subscribes with `ids` for the root and `#e` for replies.
- It stores incoming events in the shared event cache.
- It closes subscriptions on tab close.
