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

## Phase B review

- The sliver rule asks for an icon-plus-close tab of 56px, while touch requires
  a 44px close target. A 16px icon plus that target already needs 60px before
  padding. Touch slivers need a deliberate exception to the width rule.
- At the 96px height minimum, a 34px header leaves 62px. Three lines at the
  specified 24px line height cannot fit, before padding or controls. The
  short-height promise needs a minimum-height exception or a smaller measure.
- "Counts complete" means the selected relays answered, not that all of Nostr
  was counted. Current count lookups cap each relay at 3000 matching events;
  failures, outstanding answers and hits at the cap retain the plus sign.
- Duplicate copies the view and navigation history. The design does not say
  whether its unsent draft should be copied; it starts an independent draft.
- Cross-workspace layout Undo needs a transaction across both desks. Individual
  layout recovery can otherwise recreate a moved tab's identity. This needs a
  coordinated recovery policy before move undo is advertised. Recovery now
  refuses that collision and explains it; it never duplicates a draft key.
- The script-language filter is explicitly a heuristic, removable in its feed.
  Script detection cannot reliably distinguish English from all Latin-script
  languages, or Japanese from all Han-script text. Language labels need this
  limitation; a protocol language tag would provide better evidence.

## Design source update during this run

The upstream document changed at 12:55 UTC, adding Addresses and Language and
removing the wide-tile measure cap. The final copy includes those changes and
wide content now fills its tile. Clean paths, document titles and the build
rule rejecting literal interface strings remain unimplemented. Existing JSON
hash routing remains visible and is explicitly not compliant with Addresses.

## Remaining work

The numbered Phase B features remain incomplete. See [status.md](status.md)
and the observed open rows in [details.md](details.md). This run adds workspace,
tab and size foundations and selected reading fixes; it does not claim the
complete three-phase product or all ten experience promises.
