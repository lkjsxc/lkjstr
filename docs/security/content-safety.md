# Content Safety

## Purpose

This contract defines how untrusted relay events, profile metadata, URLs, media,
upload responses, zaps, and diagnostics are rendered safely.

## Current Behavior

- Event content renders as text tokens and safe links, not as raw HTML.
- Nostr identifiers become profile, thread, or address links through parsed
  protocol entities.
- Profile metadata and relay messages are untrusted strings and must wrap inside
  their containers.
- External links open with safe attributes and do not execute app code.
- Media previews are lazy, URL-based, and must handle failed loads.
- Sensitive NIP-36 content stays hidden until local reveal when the setting is
  enabled.
- Logs and Stats rows use redacted records and bounded diagnostics.

## Invariants

- No relay payload can inject HTML, scripts, styles, or event handlers.
- No upload provider response can mark a publish as successful by itself.
- Broken or blocked media renders an unavailable state instead of crashing the
  feed.
- Zap invoice handoff does not imply wallet custody.
- Diagnostics never include private keys or raw signer secrets.

## Media And Upload Trust

Upload responses are untrusted. The app parses media URLs and NIP-94-style
metadata tags, validates expected hashes where the provider contract supplies a
hash, and stores only the normalized URL and tags needed for publishing.

## Failure Behavior

- Unsafe or unsupported URLs stay text or show an unavailable state.
- Failed image loads fall back to text labels or compact unavailable states.
- Malformed upload, zap, relay, or profile responses show typed user-visible
  errors at the owning surface.
- Partial relay failure remains diagnostic and does not block reachable relays.

## Source Map

- `src/lib/events/content-tokens.ts`: safe content tokenization.
- `src/lib/components/events/`: event, media, reference, emoji, and action UI.
- `src/lib/protocol/nip19.ts`: Nostr entity parsing.
- `src/lib/protocol/nip30.ts`: custom emoji parsing and rendering safety.
- `src/lib/media/`: upload provider parsing and media metadata normalization.
- `src/lib/log/app-log.ts`: redacted diagnostics.

## Acceptance Checks

- `pnpm test -- tests/unit/events/content-tokens.test.ts`
- `pnpm test -- tests/unit/protocol/nip19.test.ts tests/unit/protocol/nip30.test.ts`
- `pnpm test -- tests/unit/media/media.test.ts tests/unit/log/app-log.test.ts`
