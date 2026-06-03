# Feed Scan

## Purpose

This module owns pure adaptive grouped scan planning. It consumes durable scan
hints and segment feedback, then returns explicit plans, next hints, and traces.
It performs no browser I/O and never treats hints as coverage proof.

## Table of Contents

- `cursor.rs`: scan direction and visible edge cursor.
- `segment.rs`: bounded time segments and split rules.
- `feedback.rs`: feedback labels, counts, and next-span reduction.
- `hint.rs`: durable scan hint record and compatibility checks.
- `hint_update.rs`: next-hint reduction from segment feedback.
- `coverage.rs`: uncovered interval input and proof guard helpers.
- `planner.rs`: plan input, output, diagnostics, and source selection.
- `trace.rs`: Stats-ready scan trace projection.
- `tests.rs`: scan learning and proof-separation tests.
