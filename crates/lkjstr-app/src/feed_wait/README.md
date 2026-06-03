# Feed Wait

## Purpose

This module owns pure feed wait and late-merge decisions. It does not open relay
subscriptions or inspect raw relay payloads. It decides first paint, terminal
empty, incomplete rows, timeout state, and scroll-anchor preservation.

## Table of Contents

- `policy.rs`: first-paint and wait-state reducer.
- `late_merge.rs`: canonical late event insertion reducer.
- `empty_state.rs`: terminal empty proof helper.
- `scroll_anchor.rs`: scroll anchor decision records.
- `tests.rs`: cache, slow relay, timeout, late merge, and cancel tests.
