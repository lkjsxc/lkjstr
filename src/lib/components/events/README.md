# Event Components

## Purpose

This directory owns shared Nostr event display: rows, content, references,
actions, reaction summaries, zaps, emoji, and media.

## Table of Contents

- Event rows, metadata, content tokens, mention chips, custom emoji images,
  embeds, media, reaction actor lists, and action panels.
- `EventContentCore.svelte` owns the shared content, media, reference,
  sensitive-content, and emoji pipeline.
- `EventMeta.svelte` owns retained Svelte row metadata plus copy/nearby-author
  overflow behavior while Svelte rows remain shipped.
- `EventMoreMenu.svelte` is a retained, unmounted deletion target; product rows
  must not import or instantiate it while final deletion gates remain open.
- `action-availability.ts` keeps optional event/profile actions from rendering
  no-op buttons.
- `event-more-menu.ts` owns explicit clipboard copy success/failure labels and
  action availability for shipped Svelte event rows.
- `zap-copy-status.ts` owns explicit zap invoice clipboard success and failure
  labels.
- `EventRepostTarget.svelte` renders reposted targets through that shared
  pipeline with contextual repost chrome.
