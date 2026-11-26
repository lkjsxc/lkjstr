# Profile editing

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
