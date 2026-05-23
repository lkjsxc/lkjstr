# Profile Edit

## Purpose

Profile Edit is the active-account metadata write surface.

## Contract

- Profile Edit opens from own-profile actions and from New Tab.
- Opening focuses an existing Profile Edit tab in the same tile before creating
  another one.
- The tab always edits the current active signing account.
- Editable fields merge with the newest cached kind `0` metadata.
- Blank known fields are omitted from the published metadata object.
- Unknown metadata keys are preserved during edits.
- Successful publish writes kind `0` metadata to enabled write relays and stores
  the signed event locally.
- Picture and banner URL fields can use the shared media upload provider.
