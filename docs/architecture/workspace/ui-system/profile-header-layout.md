# Profile Header Layout

## Purpose

Profile header layout defines the in-flow profile card that leads Profile tab
virtual lists.

## Block Order

Top to bottom inside `.profile-card`:

1. Banner media or placeholder.
2. Avatar and action row (overflow copy menu, own-profile actions).
3. Display name (`h2`).
4. Following count (button when known, muted status when discovering).
5. Subtitle (NIP-05 or fallback).
6. Full `npub` (`small`).
7. About text (`ProfileAbout`).
8. Facts row (website link, copy confirmation). Website links use
   `noopener noreferrer` when they open a new browsing context.

## Spacing

- Identity block uses `gap: var(--space-1)` between name, count, subtitle, and
  npub.
- About block uses `margin-bottom: var(--space-5)` before the first note row.
- Avatar overlaps banner with negative top margin; text and notes never overlap
  banner media.

## Actions

- `Open user timeline` lives in the overflow copy menu, not as a large fact
  button.
- Following count opens Followees when the viewed profile kind `3` list is
  known.
- Row click on Followees list entries still opens Profile.

## Distinction from Feed Identity

- `FeedIdentityHeader` is for User Timeline and Followees leading rows. It never
  shows raw `npub`.
- `ProfileHeader` is the full profile card with `npub`, following count, about,
  and facts.

## Source

- `src/lib/tabs/profile/ProfileHeader.svelte`
- `src/styles/identity.css`

## Related

- [identity-surfaces.md](identity-surfaces.md).
- [../../../product/feeds/profiles.md](../../../product/feeds/profiles.md).
- [overflow-actions.md](overflow-actions.md).
