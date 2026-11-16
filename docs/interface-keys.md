# Interface specification: password-protected keys

## Purpose

The surfaces for NIP-49 keys: signing in with one, unlocking and locking, making a protected copy, and protecting a
key that is already on the device. Engine contract: [keys.md](keys.md). Index and rules:
[interface-specs.md](interface-specs.md). Everything here lives in the Accounts tab; no dialog, no new tab.

## Shared rules

- A password field is `type=password`, never echoed, emptied the moment it is sent, and what was typed is stored
  nowhere. `autocomplete` is `current-password` when unlocking and `new-password` when choosing one.
- Choosing a password always shows two fields, `account.password` and `account.password.again`. The action button is
  neutral until both hold at least 8 characters and are equal. On leaving the second field: under 8,
  `account.password.short`; unequal, `account.password.mismatch`; one line under the fields in `--muted`.
- The engine derives the key for one to several seconds. While it does, the button is off and the busy line named in
  the item stands under it. Nothing else on the page is blocked.
- Failures are one line under what was pressed and the keyboard returns to the password field. Result codes map as
  follows; anything else is the existing `error.<code>` string.

| Result | Unlock | Sign in with ncryptsec |
| --- | --- | --- |
| `rejected` | `account.fail.password` | `account.fail.encrypted` |
| `too-large` | `account.fail.heavy` | `account.fail.heavy` |

- Export always uses the engine default cost (`logN` absent). No strength control is drawn.
- Nothing here is drawn for an engine below protocol 6.

## K1 Sign in with a password-protected key

The existing key field also takes an `ncryptsec1...` text. Its placeholder (`account.add.key`) and its refusal
(`account.fail.rejected`) already say so.

1. The reader pastes the text and presses `account.add.submit`. The interface keeps the text in memory only and the
   field empties, as today.
2. In place of the key field: a password field labelled `account.import.password`, the line `account.import.hint` in
   `--muted`, the button `account.import.submit` and `account.cancel`. Focus is in the field.
3. Submit sends `account.importEncrypted`. Busy line: `account.busy.unlock`.
4. Success behaves as any sign-in: the account is active and unlocked, the tab that signed in closes. The kept text is
   dropped.
5. Failure: the line from the table; the kept text stays so only the password is typed again. Cancel, leaving the tab
   or hiding the page for more than one minute drops the kept text and restores the key field.

Signing in with a protected key for an account that is on the device with an unprotected key replaces that storage
(the engine does this only after the password is proven). No extra question: the reader asked for exactly this.

Scenes: password step, busy, wrong password.

## K2 Locked accounts

Implementation difference: a reload can remain unlocked while another client keeps the shared Worker alive;
Lock or a Worker restart revokes access for every client.
Implementation difference: Lock waits for encrypted editor saves for up to 15 seconds; unresolved expired editors refuse it.

A protected key is locked after every reload. Reading works; signing, decrypting and backup do not.

**Account row.** The signer line reads `account.signer.protected` while unlocked and `account.signer.locked` while
locked. A protected row offers `account.lock` or `account.unlock` before `account.backup`, in the same quiet button
style. Lock acts at once with no question and no toast: the row says Locked.

**Unlock box.** `account.unlock` opens a box under the row, built like the key box: one password field
(`account.password`), the button `account.unlock`, `account.cancel`. Busy: `account.busy.unlock`. Success closes the
box and returns focus to the row. Only one box is open in the tab.

**Elsewhere, while the active account is locked:**

- The account face in the top bar carries a small closed-lock mark where the read-only mark sits. The account menu
  starts with a row `account.unlock` that opens the Accounts tab with the unlock box open and focused.
- The composer says `account.signer.locked` where it says Read-only for a public key, and Post is off. Actions that
  publish are drawn off as for a read-only account. A press says `account.locked.toast`; the toast leads to the same
  unlock box.
- After a successful unlock everything is drawn on again without a reload; a draft typed before is still in its field.
- The Messages tab and conversation tabs show `dm.locked` with the button `account.unlock` in place of their content
  (see interface-dm.md).

**Idle lock.** Setting `set.lockIdle` (group Accounts, a number of minutes, default 0, with `set.lockIdle.d`). When it
is above 0 and that many minutes pass with no key press and no pointer move inside lkjstr, the interface sends
`account.lock` for every unlocked protected account. A hidden page counts as idle time. Typing a password restarts the
count.

Implementation scope: idle activity is shared across live lkjstr pages using timestamp-only messages; lock and unlock still apply to the shared Worker session.

Scenes: row locked, row unlocked, unlock box, wrong password, top bar with the lock mark and the menu open, composer
locked.

## K3 Back up key

`account.backup` opens the existing box under a local account. Its content is now, top to bottom:

1. For a locked account only: the line `account.unlockFirst` and the button `account.unlock` (opens the unlock box);
   nothing below is drawn.
2. Heading `account.copy.title` (600, interface size). Two password fields per the shared rules and the button
   `account.copy.make`. Busy: `account.copy.busy`. Sends `account.exportEncrypted`.
3. On success the fields and the button give their place to: a read-only field labelled `account.copy.label` holding
   the returned text, uncovered (it is ciphertext), selected on focus; the buttons `account.key.copy` and
   `account.copy.save`; then `account.copy.how` in `--muted`. `account.copy.save` downloads the text as `lkjstr-<first
   8 of the npub after npub1>.ncryptsec.txt`. The text is kept in the box only and is dropped when the box closes.
4. A hairline, then one quiet line: `account.raw.open`. Pressing it unfolds the existing secret-key part unchanged
   (covered field, Show, Copy, `account.key.warn`) with `account.raw.warn` above it. Folding it or hiding the page
   covers and drops the key as today.
5. `account.key.done`, or for a freshly created account `account.key.saved`, as today. A created account still opens
   on this box; the raw part starts folded like any other.

Scenes: box as opened, copy made, raw part unfolded, locked account.

## K4 Protect a key already on the device

A local account whose key is not protected offers `account.protect` on its row, after `account.backup`.

1. It opens a box under the row: `account.protect.warn` in `--fg`, two password fields per the shared rules, the
   button `account.protect.submit`, `account.cancel`.
2. Submit runs, in order, `account.exportEncrypted {pubkey,password}` and then `account.importEncrypted` with the
   returned text and the same password. Busy for both: `account.busy.protect`. The returned text is never shown here
   and is dropped after the second answer.
3. Success: the box shows `account.protect.done` and the buttons `account.backup` (opens K3) and `account.key.done`.
   The row now reads `account.signer.protected`, unlocked for this session.
4. Any failure: `account.protect.failed`, then the mapped error line. The engine leaves the stored key untouched
   unless the import commits; the interface never calls anything that removes a key here.

There is no "remove the password" action in this batch. No account is converted by itself and no prompt suggests it:
the row action is the only way in.

Scenes: box as opened, mismatch line, done.
