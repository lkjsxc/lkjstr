# Feed LOD

## Purpose

This module owns a pure real-data level-of-detail tree for feed rows. It indexes
real row ids, timestamps, heights, loaded state, and coverage state for stable
scroll math and materialization planning.

## Table of Contents

- [mod.rs](mod.rs): module exports.
- [block.rs](block.rs): row and block records.
- [tree.rs](tree.rs): tree build and height updates.
- [query.rs](query.rs): offset, visible range, materialization, and coverage.
- [tests.rs](tests.rs): unit coverage.
