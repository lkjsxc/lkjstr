# Event Actions

## Purpose

Event actions define the row-level write controls available on feed events.

## Contract

- Event rows expose Heart, Repost, Reply, Zap, and Emoji controls.
- Clicking an action does not open the row thread.
- Heart publishes a NIP-25 kind `7` reaction with content `+`.
- When the active account already published a qualifying like reaction for the
  target event, the Heart button uses `aria-pressed="true"` and a strong visible
  outline or frame. The label stays `Heart`.
- When the active account already published a qualifying repost for the target
  event, the Repost button uses `aria-pressed="true"` and the same pressed
  styling. The label stays `Repost`.
- Pressed styling must be clearly stronger than default icon buttons and match
  the reply/zap active treatment in weight, not only color.
- Optimistic or published Heart/Repost pressed state must not reset to
  unpressed while async action-state cache refresh is pending. Optimistic state
  is scoped to the active pubkey and visible event ids.
- Emoji opens the shared tile-scoped picker without changing row height and
  publishes a NIP-25 kind `7` reaction with picker-provided Unicode content.
- Custom emoji reactions publish exactly one `:shortcode:` content value and
  one matching NIP-30 `emoji` tag from the active account emoji source.
- Reaction summaries render `+` and empty content as heart reactions, render
  `-` as dislikes, render custom emoji from matching tags, keep same-shortcode
  emoji distinct by URL and address, and mark rows containing the active
  account's reaction with stronger visual treatment in the summary chips.
- Expanded reaction and repost actor lists render as left-aligned rows with
  avatar before name.
- Repost publishes NIP-18 kind `6` for kind `1` notes.
- Repost publishes kind `16` with `k` tags for non-kind `1` events.
- Reply opens an inline composer under the event, supports `Ctrl+Enter`, and
  publishes a tagged kind `1` reply.
- Zap opens an inline amount/message form, signs a NIP-57 kind `9734` request,
  fetches an invoice, then exposes a `lightning:` payment URI.
