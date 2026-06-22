# Skill: Media Upload

## Purpose

Move media upload validation, Blossom/NIP-B7 transport, NIP-96 compatibility,
NIP-98 scoped auth, progress, retry, and insertion truth into Rust/WASM.

## Trigger

Use when editing Upload Settings, Tweet or Profile Edit media attachment,
Blossom providers, NIP-96 discovery, NIP-98 auth, or media job storage.

## Read First

- [../../protocol/media-upload.md](../../protocol/media-upload.md).
- [../../product/tools/upload-settings.md](../../product/tools/upload-settings.md).
- [../../architecture/workspace/ui-system/media-upload-gate.md](../../architecture/workspace/ui-system/media-upload-gate.md).
- [../../architecture/rust-wasm/protocol-kernel.md](../../architecture/rust-wasm/protocol-kernel.md).
- [security-local-keys.md](security-local-keys.md).

## Files Likely Touched

- `crates/lkjstr-protocol/` upload descriptors and NIP-98 helpers.
- `crates/lkjstr-storage/` upload settings and job rows.
- `crates/lkjstr-web/` fetch/file host adapters.
- `crates/lkjstr-ui/` upload surfaces.
- `src/lib/media/`, `src/lib/tabs/upload-settings/`, `src/lib/tweet/`, and tests.

## Procedure

1. Keep Blossom the preferred media target and NIP-96 as compatibility.
2. Validate provider metadata and descriptor hashes before success.
3. Scope NIP-98 auth to the upload request and active signer.
4. Insert media URLs into drafts only after real upload success.
5. Render progress, retry, unavailable, denied, and failure states explicitly.

## Focused Gate

```sh
pnpm test -- tests/unit/media
pnpm test -- tests/unit/protocol
cargo test -p lkjstr-protocol upload
pnpm verify:quiet
```

## Final Gate

Run Docker final gate before broad media upload parity or deletion claims.

## Must Not

- Do not fake upload success or descriptor hashes.
- Do not leak auth headers, signer material, or file contents into logs.
- Do not silently fall back between providers.

## Handoff

List provider validation, auth proof, upload transport proof, insertion gate,
redaction checks, and remaining TypeScript paths.
