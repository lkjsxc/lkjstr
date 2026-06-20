# Event Components

## Purpose

This directory owns shared Nostr event display: rows, content, references,
actions, reaction summaries, zaps, emoji, and media.

## Table of Contents

- Event rows, metadata, content tokens, mention chips, custom emoji images,
  embeds, media, reaction actor lists, and action panels.
- `emojified-text-plan.ts` owns retained inline text token keys and custom emoji
  token presentation for labels.
- `event-content-plan.ts` owns retained Svelte content reference, nested
  repost target labels, attachment, summary, and sensitive-content label/reveal
  planning.
- `content-token-plan.ts` owns retained content-token keys, URL link policy,
  URL propagation control, profile labels, and hidden event-token visibility.
- `ContentTokenLink.svelte` renders retained URL token anchor chrome from that
  plan.
- `custom-emoji-image-plan.ts` owns retained emoji image alt, fallback, lazy
  loading, async decoding, and no-referrer policy.
- `feed-surface-status-plan.ts` owns retained event-list error, loading, end,
  and empty status planning.
- `feed-action-states-bridge-plan.ts` owns retained optimistic action-state
  scoping for visible events and active accounts.
- `media-attachment-plan.ts` owns retained external media-open target/dispatch,
  anchor link policy, propagation control, video/audio open labels, and shared
  open-button chrome.
- `EventContentCore.svelte` renders the shared content, media, reference,
  sensitive-content, and emoji pipeline from that plan.
- `EventContentWarning.svelte` renders retained sensitive-content warning
  chrome and reveal controls from the focused content plan.
- `event-mention-chip-plan.ts` owns retained inline event mention labels,
  titles, opener suppression, resolver keys, relay selection, excerpts, and
  profile hydration/load-state planning.
- `profile-mention-chip-plan.ts` owns retained inline profile mention
  openability, title, text, custom emoji presentation data, and shared chip
  chrome.
- `event-reference-card-plan.ts` owns retained reference preview labels,
  excerpts, media labels, unavailable text, relay/profile selection,
  openability, and propagation-aware keyboard/click activation.
- `event-reference-hydration.ts` owns retained reference preview keys, loading
  status/state, render visibility, load lifecycle, and missing-author profile
  hydration planning.
- `event-reference-list-plan.ts` owns retained reference preview collapse and
  expansion labels, toggle state, and propagation control.
- `event-actions-plan.ts` owns retained action mode toggles.
- `event-actions-label-plan.ts` owns retained action button and reply labels.
- `event-actions-run-plan.ts` owns retained publish status fallbacks, action
  completion state, run busy/status lifecycle, and destroyed-state settling.
- `event-actions-reaction-plan.ts` owns retained Unicode/custom emoji reaction
  payloads and active-account emoji source planning.
- `event-actions-control-plan.ts` owns retained Heart/Repost pressed state plus
  Reply/Zap active and busy-disabled button state.
- `event-actions-panel-plan.ts` owns retained Reply/Zap inline panel visibility
  and reply submit disabled state.
- `event-actions-reply-plan.ts` owns retained reply submit gating/default
  prevention and Ctrl-Enter keyboard submit planning.
- `EventActionIconButton.svelte` renders retained action-bar icon button chrome
  from the focused action control and panel plans.
- `EventActionInlinePanel.svelte` renders retained reply/zap inline panel
  chrome from the focused action panel and reply plans.
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
- `event-tree-list-row-plan.ts` owns retained row render branches, profile,
  optimistic action, reaction, and repost data projection.
- `reaction-summary-label-plan.ts` owns retained reaction/repost summary keys,
  icons, accessibility labels, trigger labels, and count text.
- `reaction-summary-plan.ts` owns retained reaction/repost summary expansion
  state, own markers, actor display, actor rows, and actor open
  availability/dispatch planning.
- `ReactionSummaryActorRow.svelte` renders retained reaction/repost actor row
  openable/static chrome from the focused reaction summary plan.
- `EventMeta.svelte` renders retained Svelte row metadata, shared author
  identity chrome, and overflow controls while Svelte rows remain shipped.
- `action-availability.ts` keeps optional event/profile actions from rendering
  no-op buttons.
- `event-profile-activation.ts` owns retained profile-open labels, callback
  checks, and propagation suppression.
- `event-row-presentation-plan.ts` owns retained row profile/thread openability
  and depth styling shared by full and fragmented Svelte rows.
- `EventRowFrame.svelte` renders retained full/fragmented row frame chrome,
  interactive role/tab stop, depth style, and success-highlight class from the
  focused row presentation and activation plans.
- `EventRowAvatar.svelte` renders retained row avatar profile-open chrome from
  the focused row presentation and profile activation plans.
- `event-row-activation.ts` owns retained event-row click/key open dispatch,
  local-control suppression, and success-highlight scheduling/cleanup while
  Svelte rows remain shipped.
- `event-row-local-target.ts` keeps retained row-local controls and media
  controls from opening the parent thread row.
- `event-meta-overflow.ts` owns explicit overflow menu/action labels,
  propagation control, copy-action propagation, and nearby-author
  availability/dispatch for shipped Svelte event metadata.
- `event-meta-copy-status.ts` owns retained event-id clipboard copy
  success/failure labels, fallback reasons, and copy-status reset lifecycle.
- `zap-copy-status.ts` owns explicit zap invoice clipboard success/failure
  labels and copy-status lifecycle.
- `event-zap-panel-plan.ts` owns retained zap form/control labels.
- `event-zap-submit-plan.ts` owns retained zap submit lifecycle/gating/state,
  invoice status, error fallback, and submit default prevention.
- `event-zap-row-plan.ts` owns retained zap invoice row state/keys/labels,
  invoice-open target/dispatch, invoice presence, and amount display planning.
- `EventZapInvoiceRow.svelte` renders retained zap invoice row chrome from the
  focused zap row plan.
- `EventRepostTarget.svelte` renders reposted targets through that shared
  pipeline with contextual repost chrome.
