# Design review

## Purpose

Record contradictions and unspecified choices in the authoritative design.
The design itself is preserved verbatim; this file does not amend it.

## Decisions in the foundation

- Light ink-3 on surface is 3.66:1; dark ink-3 on surface is 4.04:1.
  Both miss the document's 4.5:1 requirement. The tokens are exact, while
  readable metadata and inactive tab labels use ink-2, as its prose permits.
- Light seal on surface is 4.47:1. New-note pills use the raised surface,
  where seal passes AA. Seal remains reserved for unseen information.
- The space section says 36px touch controls; experience promise 7 says 44px.
  The phone frame uses 44px controls and a 44px tab strip.
- Website embedding cannot be guaranteed in a browser-only client: websites
  can forbid frames. A linked website opens a tile with an explicit action
  to visit it in an external browser tab. Images render inside their tile.
- Day dividers currently use UTC, matching timestamp tooltips. The design
  does not specify timezone boundaries or how they change while reading.
- History is bounded to 64 entries per tab; close/layout recovery retains
  32 snapshots for this page lifetime. The design gives no retention bound
  or requirement to persist undo after a page reload.
- The 360px split minimum is honoured for new automatic detail splits.
  Explicit splitting of an already narrow pane is not fully specified.

## Remaining work

Nine workspaces and the first-run feed/banner/language heuristic are not
implemented in this run. Existing view text is only partly translated;
frame/common labels share a Japanese/English table. The emoji picker, full
note menus, every modifier path, and phone gestures remain incomplete. The newly added Sizes rules and advanced
tab gestures/settings are also pending.
Scroll through history still requires browser coverage. Silent feed, search,
thread and signer requests, blocked storage boot, and failed images are checked.
