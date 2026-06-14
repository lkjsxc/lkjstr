# Feed View Model Source

## Purpose

Pure shared feed row view-model data for Rust-owned feed surfaces.

## Table of Contents

- `build.rs`: conversion from feed-window events plus explicit state rows.
- `content.rs`: shared event content planning and sensitive-row policy.
- `content_row.rs`: render-ready shared event content row data.
- `geometry.rs`: event-row geometry model key selection.
- `ids.rs`: stable row-id constructors.
- `media_rows.rs`: real media attachment row insertion.
- `mod.rs`: public view-model exports.
- `reference_rows.rs`: real reference identity row insertion.
- `types.rs`: row, footer, unavailable, and diagnostic data types.
