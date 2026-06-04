# Schema Steps

## Purpose

Schema steps describe how SQLite shape changes land without making docs or
diagnostics drift from the live database.

## Rules

- Logical table families live in the Storage Manifest.
- SQLite table creation lives in typed SQLite repository schema modules.
- A table shape change updates docs, repository codecs, and tests in the same
  change.
- Removed old stores are reported through presence-only diagnostics, not live
  table manifest rows.
- Diagnostics treat missing SQLite tables as unavailable or incomplete.
- Missing tables never authorize deletion of protected data.

## Verification

Schema changes require:

- Unit test that logical table names match the manifest.
- Repository check that the docs matrix matches the manifest.
- Storage inventory test showing no live table reports `unknown`.
- Storage startup test for blocked, unavailable, or temporary storage paths when
  the change can affect existing browser profiles.
