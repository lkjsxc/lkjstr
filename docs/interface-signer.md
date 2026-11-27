# Interface specification: waiting on a browser extension

## Purpose

Owner #3118 puts the browser extension signer (NIP-07) in the performance work. Today a missing `window.nostr` fails
at once, even when the extension simply has not injected yet; a send waits silently for ten seconds before naming
the extension; and signing in with an extension disables every way to sign in behind "Waiting for the extension..."
with no way out. This item says what the reader sees while lkjstr waits on an extension, and when they can stop
waiting. Index and rules: [interface-specs.md](interface-specs.md). It extends P1 Sending and
[design.md](design.md#writing-and-acting); it does not change relays, delivery or what counts as Sent.

## Decisions

- Two different waits, said differently:
  - **Injection**: the account signs with an extension, but `window.nostr` is not there yet. Extensions add it to
    the page some time after it loads. lkjstr is looking for the extension; nobody has been asked anything.
  - **Request**: lkjstr has called the extension (`signEvent`, or `getPublicKey` to sign in) and the call has not
    returned. The extension holds it; the only reasons are a prompt waiting for the reader or the extension itself.
    This is the one wait that may be called approval, and the one that offers Cancel.
- A remote signer (NIP-46) is not part of this item. Its request is not verifiably waiting on the reader (relays
  may be slow), so it keeps P1's ten-second naming; an explicit `auth_url` keeps its own flow
  ([bunker-auth.md](bunker-auth.md)).
- Nothing blocks. No spinner, no disabled field, no disabled list. Waiting is one muted line where the send or the
  sign-in already says its state, and Cancel beside it.
- Reading never waits on the extension: Home, threads, profiles and the account face draw from what is stored.
  The extension is first asked when something must be signed or decrypted.

## Spec: P2 Waiting on a browser extension

### Timing

| Wait | Silent | Then says | Ends |
| --- | --- | --- | --- |
| Injection | first 1 s | `signer.finding` | `window.nostr` appears (go on to the request), or 3 s after the page's load event and at least 1 s after the press: the existing missing failure |
| Request | first 1 s | `signer.approve` (send) or `signer.approveSignIn` (sign-in), with Cancel | the answer, a refusal, or Cancel |

- The first second stays silent so an extension that answers at once (most do, once lkjstr is allowed) never
  flashes words. The extension's ten-second mark of P1 is removed in the same change (its branch in
  `send-state.ts` `waitKey`, and the extension half of the P1 lines in design.md); P1 keeps it for a remote signer.
- Looking for the extension checks `window.nostr` every 100 ms and stops at the deadline; it is released when the
  send or the sign-in is cancelled, removed or the tab closes.

### Sending (Post tab, the field under a thread's focus, Quote, a channel, Home's retained draft)

- Pressing Post empties the field and leaves the caret there at once, as now. The sending draft below it, and the
  same draft in Home, say `compose.pending` ("Sending...") for the first second.
- Injection still running after 1 s: the line says `signer.finding`. At the deadline: the existing
  `error.signer-missing` failure with Retry, Edit and Remove.
- Request outstanding after 1 s: the line says `signer.approve`, followed by a text button `compose.cancel` in the
  line's own muted style, in tab order right after the line. It is the only button the line has.
- Cancel: the send stops at once. The draft stays, saying `signer.cancelled`, with Retry, Edit and Remove. Nothing
  is published: a signature that arrives later is dropped, as an answer to a send that no longer wants it is today.
  Retry asks the extension again.
- The extension answers: P1 goes on unchanged (relay answers, Sent on the first acceptance). The words leave the
  line in the same frame; no closing animation.
- The extension refuses: the existing refused failure, unchanged.

### Signing in with an extension (the Accounts tab)

- Pressing "Sign in with a browser extension" changes only that button's line: `signer.finding` after 1 s while
  looking, `signer.approveSignIn` after 1 s of an unanswered request, with Cancel (`account.cancel`) beside it.
- The other ways to sign in (key, remote signer, create) stay usable throughout. Starting another way cancels the
  extension's wait first.
- Cancel: the button is pressable again and its line says `signer.cancelledSignIn`. A later answer from the
  extension is ignored; no account is added from it.
- Not found at the deadline: the existing `account.fail.missing` words. Refused: `account.fail.refused`.

### Keys and reading order

- Cancel is a real button: Tab reaches it, Enter or Space presses it. No new shortcut; Escape keeps its meanings.
- The waiting line is announced politely (`aria-live="polite"` on the line that already holds the send's state);
  Cancel is not announced on its own.

### Strings

New, in both tables: `signer.finding`, `signer.approve`, `signer.approveSignIn`, `signer.cancelled`,
`signer.cancelledSignIn`, `compose.cancel`. Existing: `compose.pending`, `error.signer-missing`,
`account.cancel`, `account.fail.missing`, `account.fail.refused`, `account.busy.remote`. Removed when this is
built: `account.busy.extension`, which nothing draws any more (owner #3156: no obsolete paths).

### Engine

- The `signed` answer may carry `error: 'cancelled'`, and the action's result reports it as a failure that
  published nothing. The engine and the interface take it in the same change (one line in
  `engine-proposals.md`); there is no interim mapping onto `signer-refused` (owner #3156).
- The injection wait lives in the main-thread NIP-07 answerers (`client-crypto.ts` and the real transport's
  `getPublicKey`), which are the only code that sees `window.nostr`. No product policy moves to JavaScript: the
  deadline is a transport wait, like a socket's.

### Verification

- Mock signer doubles on `window.nostr`: injected 1.5 s after load; answering in 50 ms; answering after 20 s;
  refusing. Facts: no words before 1 s for the fast one; `signer.finding` then a normal send for the late one;
  `signer.approve` and Cancel at 1 s for the slow one, Cancel keeps the draft, and its late signature publishes
  nothing (no `publish.signed`, no relay EVENT); the refusal unchanged; sign-in keeps the other ways pressable.
- Real-engine loopback: the same four doubles in `smoke:real`, no public relays.
- `pnpm shots` scenes `send-waiting`, `send-cancelled`, `signin-waiting` at 1440 dark and 390 light.
- The #3102 slow-line bench reports, for the extension double that answers at once, that nothing is added to
  time-to-Sent.

## Not in this item

Reactions, reposts and deletions held for Undo (they sign after Undo lapses, away from any line), private message
decryption prompts (their own words in the Messages tab), and remote signers. Each needs its own place to say it.
