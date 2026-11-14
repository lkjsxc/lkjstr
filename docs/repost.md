# Reposts

## Purpose

Source comparison for Phase B, reviewed 2026-11-14. These are source observations,
not claims from a live account. No public relay was contacted.

## Comparison

[Nostter](https://github.com/SnowCait/nostter/blob/78e22b7a7e79825290ee779a958a368eb90833f7/web/src/lib/components/RepostButton.svelte)
opens a dropdown on the first press. It offers Repost, Quote, and, when already
reposted, another repost and Undo. Signing is followed by send and immediate
local state update; its selected icon is green. Quote opens the note dialog
with a quotes array, giving the writer the quoted card immediately. Its
[undo helper](https://github.com/SnowCait/nostter/blob/78e22b7a7e79825290ee779a958a368eb90833f7/web/src/lib/author/Repost.ts)
deletes the newest own repost and updates local state. A separate attribution
row precedes the original event component. An unavailable target becomes a
note link rather than rendering the repost's raw payload. The inspected button
has no numerical count or grouping policy of its own.

[Damus](https://github.com/damus-io/damus/blob/4a94f666d7e159e380e10b4dbbb2967d1688709e/damus/Features/Actions/Reposts/Views/RepostAction.swift)
also separates Repost and Quote in an action sheet. Quote notifies the composer
with the original event. Its
[attribution component](https://github.com/damus-io/damus/blob/4a94f666d7e159e380e10b4dbbb2967d1688709e/damus/Features/Actions/Reposts/Views/Reposted.swift)
uses a small actor picture, an actor name and a count of other reposters, with
a route to the reposter list. The count updates on stats notifications.
Its changelog records collapsing duplicate reposts in Home and actionable
unavailable quote views. These are stronger feed-level precedents than
nesting a complete new note for each repost. The action sheet alone does not
prove an undo policy or selected-state colour, so those are not inferred here.

[Lumilumi](https://github.com/TsukemonoGit/lumilumi/tree/bfa34aa187af9cb02223beb1cff201827f6b0378)
renders event-id and address references through shared note components, passes
relay hints, and changes omission at notification depth. Its repost layout
separates the kind icon, actor icon/name and actions. Its cached own-repost
observer releases subscriptions on destruction. `NoteActionButtons.svelte`
opens a Repost/Quote dropdown. Quote seeds nevent or naddr text, author choices
and the original content warning. Own reposts tint the icon; the optional
show-all-reactions mode adds the count. It updates its query cache after at
least one relay accepts. The inspected action switch has no toggle-to-delete
case; no home-feed deduplication policy is established by these components.

## lkjstr choices and current limit

The requested combination takes Nostter's immediate local state and ready-made
quote card, Damus's compact multi-actor attribution and duplicate suppression,
and Lumilumi's cache-first shared reference rendering with relay hints.
One-press repost, indigo selected state, second-press deletion, five-second
Undo, caret/long-press/context-menu/q access, and default-off confirmation come
from the owner's authoritative design, not from an invented claim that all
three clients already behave that way.

This run fixes attribution profile targets and quoted-card actor targets. It
does not yet implement that complete repost interaction or grouped reposts.
The current repost action still opens its existing menu. Unavailable targets
retain the existing bounded lookup and explicit retry.
