# Schema Steps

## Purpose

Schema steps describe how IndexedDB shape changes land without making docs or
diagnostics drift from the live database.

## Rules

- The Dexie store shape is generated from the Storage Manifest.
- A table shape change updates the schema step in the same change.
- A live table cannot be added only in `browser-db.ts`.
- Removed object-store cleanup lives in a removed-store helper, not in the live
  table manifest.
- Diagnostics treat missing object stores as unavailable or incomplete.
- Missing stores never authorize deletion of protected data.

## Removed Stores

The old passkey-protected local secret table is not a live store. Passkey
protected storage is design-only until it has a complete product, security,
repository, and test contract.

Removed-store cleanup may keep a Dexie `stores({ removedName: null })` entry in
the schema generator, but checks must not include that name in live table docs
or inventory groups.

## Verification

Schema changes require:

- Unit test that Dexie schema table names match the manifest.
- Repository check that the docs matrix matches the manifest.
- Storage inventory test showing no live table reports `unknown`.
- Startup test for missing or blocked IndexedDB paths when the change can
  affect existing browser profiles.
