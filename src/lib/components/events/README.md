# Event Components

## Purpose

This directory owns shared Nostr event display: rows, content, references,
actions, reaction summaries, zaps, emoji, and media.

## Table of Contents

- Event rows, metadata, content tokens, mention chips, custom emoji images,
  embeds, media, reaction actor lists, and action panels.
- `event-content-plan.ts` owns retained Svelte content reference, nested
  repost target labels, attachment, summary, and sensitive-content label/reveal
  planning.
- `content-token-plan.ts` owns retained content-token keys, URL link policy,
  URL propagation control, profile labels, and hidden event-token visibility.
- `custom-emoji-image-plan.ts` owns retained emoji image alt, fallback, lazy
  loading, async decoding, and no-referrer policy.
- `feed-surface-status-plan.ts` owns retained event-list error, loading, end,
  and empty status planning.
- `feed-action-states-bridge-plan.ts` owns retained optimistic action-state
  scoping for visible events and active accounts.
- `media-attachment-plan.ts` owns retained external media-open target/dispatch,
  anchor link policy, propagation control, and video/audio open labels.
- `EventContentCore.svelte` renders the shared content, media, reference,
  sensitive-content, and emoji pipeline from that plan.
- `event-mention-chip-plan.ts` owns retained inline event mention labels,
  opener suppression, resolver keys, relay selection, excerpts, and profile
  hydration/load-state planning.
- `event-reference-card-plan.ts` owns retained reference preview labels,
  excerpts, media counts, relay/profile selection, open availability, and
  propagation-aware keyboard/click activation.
- `event-reference-hydration.ts` owns retained reference preview keys, loading
  status/state, load lifecycle, and missing-author profile hydration planning.
- `event-reference-list-plan.ts` owns retained reference preview collapse and
  expansion labels, toggle state, and propagation control.
- `event-actions-plan.ts` owns retained action mode toggles, publish status
  fallbacks, run busy/status lifecycle, action labels, reply submit
  gating/default prevention, reply keyboard submit, action completion state,
  emoji reaction payloads, and emoji source planning.
- `event-actions-emoji-source.ts` owns retained account emoji source load
  request ordering and stale/destroyed-state suppression.
- `event-tree-list-helpers.ts` owns retained event-list row keys, visual rows,
  and near-start rows.
- `event-tree-list-tree.ts` owns retained event tree flattening cache and node
  keys.
- `event-tree-list-continuation-plan.ts` owns retained collapsed-thread
  continuation planning and open dispatch.
- `event-tree-list-near-start-plan.ts` owns retained near-start visual row
  targeting and offset gating.
- `event-tree-list-near-end-plan.ts` owns retained near-end observer enablement
  and root-margin planning.
- `event-tree-list-paging-plan.ts` owns retained near-end activation,
  viewport-fill, auto-fill intent resets, prefetch, newer-check scheduling,
  near-start request, and older-page request gates.
- `event-tree-list-row-plan.ts` owns retained row profile, optimistic action,
  reaction, and repost data projection.
- `reaction-summary-plan.ts` owns retained reaction/repost summary keys,
  accessibility labels, expansion state, own markers, and actor display/open planning.
- `EventMeta.svelte` renders retained Svelte row metadata and overflow controls
  while Svelte rows remain shipped.
- `action-availability.ts` keeps optional event/profile actions from rendering
  no-op buttons.
- `event-profile-activation.ts` owns retained profile-open labels, callback
  checks, and propagation suppression.
- `event-row-activation.ts` owns retained event-row click/key open dispatch,
  local-control suppression, and success-highlight scheduling/cleanup while
  Svelte rows remain shipped.
- `event-row-local-target.ts` keeps retained row-local controls from opening
  the parent thread row.
- `event-meta-overflow.ts` owns explicit overflow menu/action labels,
  propagation control, copy-action propagation, clipboard copy success/failure
  labels, copy-status reset lifecycle, and action availability for shipped
  Svelte event metadata.
- `zap-copy-status.ts` owns explicit zap invoice clipboard success/failure
  labels and copy-status lifecycle.
- `event-zap-panel-plan.ts` owns retained zap submit lifecycle/gating/state,
  invoice status, error fallback, form/control labels, submit default prevention,
  invoice-open target/dispatch, and amount display planning.
- `EventRepostTarget.svelte` renders reposted targets through that shared
  pipeline with contextual repost chrome.
