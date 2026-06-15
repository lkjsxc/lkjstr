# Feed View Model Source

## Purpose

Pure shared feed row view-model data for Rust-owned feed surfaces.

## Table of Contents

- `build.rs`: conversion from feed-window events plus explicit state rows.
- `content.rs`: shared event content planning and sensitive-row policy.
- `content_row.rs`: render-ready shared event content row data.
- `custom_emoji_rows.rs`: custom emoji token row insertion.
- `geometry.rs`: event-row geometry model key selection.
- `ids.rs`: stable row-id constructors.
- `link_rows.rs`: safe HTTPS link row insertion.
- `media_filter.rs`: product-safe media attachment filtering.
- `media_rows.rs`: real media attachment row insertion.
- `mod.rs`: public view-model exports.
- `profile_mention_rows.rs`: NIP-19 profile mention row insertion.
- `reference_rows.rs`: real reference identity row insertion.
- `types.rs`: row, footer, unavailable, and diagnostic data types.
