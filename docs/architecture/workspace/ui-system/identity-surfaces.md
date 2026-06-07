# Identity Surfaces

## Purpose

Identity surfaces convert pubkeys and cached profile metadata into compact,
consistent display UI across feeds, lists, and headers.

## Components

### `IdentityChip`

- Inline avatar, display name, and optional subtitle.
- Use in notification headers, mention chips, account rows, and hover cards.
- Never shows raw `npub` or hex pubkey text.

### `UserEventRow`

- List row with avatar, meta, and optional overflow menu.
- Row click opens Profile.
- Use in Followees and any pubkey list that behaves like a user directory.

### `FeedIdentityHeader`

- Leading feed row for a target pubkey: avatar, display name, subtitle.
- Use in User Timeline and Followees headers inside virtual feed lists.
- Hydrates profile metadata through the shared profile cache.
- Never shows raw `npub` or `Public timeline for npub...` copy.

## Display Rules

- Display name comes from profile metadata or falls back to `Unknown`.
- Subtitle may show NIP-05 when present. Feed rows and list rows do not show
  shortened `npub` or hex beside the name.
- Full `npub` text belongs only on Profile header surfaces and copy menus.
- Avatars fall back to deterministic initials when images fail.

## Feed Leading Rows

User Timeline and Followees place identity headers as the first in-flow row of
the shared virtual feed list. Status, notice, and error rows follow the same
scroll owner.

Profile keeps its full `ProfileHeader` card as a leading row. Profile identity
content shows display name, following count, subtitle, full `npub`, and about
text in the documented order. See
[profile-header-layout.md](profile-header-layout.md).

## Hydration

Visible and near-visible identity surfaces hydrate through the shared profile
coordinator. Stale hydration must not overwrite newer cached metadata.

## Related

- [../../network/identity-rendering.md](../../network/identity-rendering.md).
- [../../../product/feeds/profiles.md](../../../product/feeds/profiles.md).
- [../../../product/feeds/user-timeline.md](../../../product/feeds/user-timeline.md).
- [../../../product/feeds/followees.md](../../../product/feeds/followees.md).
