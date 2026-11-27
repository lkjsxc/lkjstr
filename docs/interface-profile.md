# Profile

## Purpose

The reader edits their own public profile (kind 0): name, About, picture, banner, NIP-05 address, website and
lightning address, with a picture either pasted as an address or uploaded from the device. Owner request,
2026-11-25: "I want a feature to edit my profile."

## P1 Edit profile

Contract: `profile.save {as,profile:ProfileEdit}` publishes; `upload {as,name,mime,bytes}` with `progress`
answers gives an address. `ProfileRow.edit?` carries the editable kind-0 fields for the active writable
account's own row. About and the optional fields use the published text. Name uses the active display alias
or the handle. The engine preserves the stored handle when the display name is unchanged.

### Where it opens

- The profile header's buttons gain `profile.edit` (a plain button, in Follow's place) only when the row is
  `self`, it is the active account and that account can publish (`can.ts` ability `ok`). Read-only, locked,
  signed out, another person, or a profile of another saved account: no button.
- A press opens an `Edit profile` tab (`view.profile-edit`) right after the profile, in the same tile; closing it
  brings the profile back. It is not on the New tab page.

### The tab

One column at a form's measure (560px), top to bottom:

1. Preview: the header's banner band, the 76px face over its lower edge and the name beside it, drawn from what
   is typed. An address that is not a usable image yet shows the flat face or an empty band.
2. One quiet line (`--muted`, 12.5px) for the state: `pedit.loading` until the editable fields arrive;
   `pedit.fresh` when no profile of the account is known;
   `pedit.other` or the read-only/locked reason when this account cannot save it. Empty, it takes no room.
3. Picture (`pedit.picture`) and Banner (`pedit.banner`): an address field (`pedit.imageUrl`), Upload
   (`pedit.upload`, a file picker for images), Remove (`pedit.remove`, shown when the field holds something) and
   Restore (`pedit.restore`, shown when it differs from the saved one). Under the row, one status line: the
   upload's progress bar and phase (`upload.*`, naming the server), or its failure in words (`servers.none`,
   `upload.signerMissing`, `pedit.notImage`, `error.too-large`, `upload.readFailed`, `error.*`). A finished
   upload puts its address in the field and the preview.
4. Name, About (a text area, five lines, grows by hand), NIP-05 address, Website, Lightning address: a label
   (`--muted`, 12.5px, 600) over each field, the field's problem under it in the error colour.
5. Save (primary) and Cancel (`account.cancel`); under them the save's failure (`failureText`).

Fields are 30px (40px on touch), 6px corners, an indigo outline when focused, no new colour.

### States

- Loading: fields off, Save off, `pedit.loading`.
- Ready: Save is neutral until something differs from the start, and while an upload runs.
- Saving: every control off, Save says `pedit.saving`.
- Saved: toast `pedit.saved`, the tab closes, its draft goes with it.
- Failed: the form stays as typed, the reason under the buttons, Save on again.
- What is typed is kept with the tab (view state) and comes back with a reopened or reloaded tab, against the
  base it started from. A profile row arriving later never rewrites a field.

### Checks before a save

A field left as it was is never refused. Otherwise: Picture and Banner start with `https://`
(`pedit.badImage`); Website with `https://` or `http://` (`pedit.badWebsite`); NIP-05 is `name@domain` or a
bare domain, saved as `_@domain` (`pedit.badAddress`); Lightning address is `name@domain`
(`pedit.badAddress`). The first refused field takes the keyboard. Edited text is trimmed, and cleared
optional fields are left out. Untouched text preserves its published value. Name may be empty.

### Published source

The form waits for the Worker's editable fields. Public display snapshots can render the profile header
and omit `ProfileRow.edit`. On save the engine keeps unrelated kind-0 fields and tags and checks the base event again
after signing. Relay delivery is tracked separately from the local profile update.

### Scenes for `pnpm shots`

`profile-edit` (ready, own profile), `profile-edit-uploading`, `profile-edit-failed`, and the own header with
Edit profile, each at 1440 dark and 390 light.

## P2 Reposts in Profile Posts

Posts includes the person's kind 6 and 16 reposts by default. One copy of the original appears at its newest
matching placement, with the same repost context as Home and the original as the target of note actions.
Posts keeps its own Reposts Show/Hide choice, drawn with the existing filter segments above the kind tabs.
The choice is saved with the profile tab. The existing Reposts tab still lists the person's repost activity.

## P3 Pinned notes

The 2026-11-27 pinned-notes assignment authorizes this surface. Opus approved the copy and spacing.
Protocol details are in [pinned-notes.md](pinned-notes.md).

### Placement and controls

- Profile keeps a separate finite pins section at the end of its scrolling header, below the kind tabs and
  above chronological notes. Use the ordinary note face, a thin separator, and the quiet `note.pinned` context
  line. No new colour, shadow, floating header or rail.
- The section reads the profile owner's public list, including on another person's profile or while signed
  out. It starts with 20 notes in list order; `pins.previous` and `pins.next` page through bounded windows with
  one boundary note. The chronological feed and its reading position keep their existing ordering.
- Align the status line left and keep Next on the right when Previous is hidden. When both links are hidden,
  the pagination row takes no space.
- In an active writable account's own kind-1 note More menu, `act.pin` becomes `act.unpin` when
  `mine.pinned` is true. Other events and other people's notes do not offer Pin. Engines below protocol 18
  receive neither the action nor the paired pins query.
- A successful action uses the existing Undo toast, `undo.pinned` or `undo.unpinned`. Undo sends the inverse
  action for the captured account and is inert after switching accounts. A failure uses the existing action
  error treatment; `error.stale-list` invites a fresh try and `error.list-edit-pending` names the signature wait.

### Read states and lifetime

- Unknown or pending references: `pins.loading`, even after the list itself made the relay phase live.
- Unavailable references after lookup: `pins.unavailable`, alongside any notes that did resolve.
- Failed list read: `pins.failed`. A settled empty list takes no room.
- Every key is present in English and Japanese. Use the paired string tables, including the section's
  accessible `note.pinned` name, instead of literal visible text.
- Header redraws preserve the intact nested note bodies and controls. The paired query opens hidden and is
  activated only for a visible profile. Hiding pauses audio and releases its read ownership; account changes
  reopen it; unmounting closes it. Pin placement is excluded from
  persisted public windows, while ordinary note membership updates with fresh engine rows.

### Review scenes

Check list order beside unchanged chronology, an unavailable reference, paging links, and another person's
pins while signed out. Review Pin, Unpin and Undo in English and Japanese. Capture 1440 dark and 390 light.
