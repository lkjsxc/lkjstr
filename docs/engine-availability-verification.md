# Account availability verification

## Purpose

Account-storage failure must not be presented as an empty account set or an
unreachable relay. Protocol 13 adds a fixed failure marker while preserving the
existing capability handshake and the last confirmed account collection.
This record separates the current addition from the completed account-storage
proof at `04c10b9b` in [engine-account-verification.md](engine-account-verification.md).

## Behavior and boundary

The native `Session::ready_account_unavailable` emits
`Ready.accountError:{code:"internal"}`. Ordinary Ready omits the optional field.
Its Rust enum has only the internal code; raw IndexedDB errors cannot be
serialized into it. The failed Worker still rejects queued and future actions
and subscriptions without claiming an Accounts snapshot or invoking a signer.

The client exposes `accountState` independently of `accounts`. It starts
loading, becomes ready only on an actual Accounts message, and becomes failed
on the explicit marker. Reconnect returns availability to loading without
clearing account rows or the active account. A capability Ready alone never
claims that account loading succeeded.

Existing feed `.fstate` uses the existing localized `error.internal` key for
this failure or an internal subscription failure. It takes precedence over
Sign in, nonempty and end-of-list branches. Retained note nodes remain mounted
and the view does not reopen its query. Ordinary signed-out Home and relay
failure wording retain their existing behavior.

No new word, CSS, layout, control, automatic toast or Accounts alert is added.
Automatic account availability in Accounts/topbar and safe recovery still need
Claude's specification; [interface-needs.md](interface-needs.md) records the
remaining surface. A blocked upgrade still requires the older connection to
close and an explicit reload; no automatic retry discards editors or keys.

## Focused client proof (2026-11-17)

The same ten client/feed cases ran before and after implementation. Eight
failed as actual assertions before, while two controls passed. They exercise
capability/Accounts separation, retained identity on reconnect, the existing
feed status and unchanged rendered-note/query identity.

| Run (UTC) | Result | Seconds | Load before; after (1/5/15 min) |
| --- | --- | ---: | --- |
| 00:31:07-00:31:10 | Eight failures, two controls pass | 3.370 | 3.32/3.88/6.40; 3.37/3.88/6.38 |
| 00:33:10-00:33:11 | Same ten pass | 0.815 | 2.16/3.19/5.82; unchanged |
| 00:42:02-00:42:04 | Final focused/static sequence passes | 1.790 | 5.41/5.39/5.92; unchanged |

The final sequence includes fifteen Vitest cases: ten client/feed, three mock
failed-boot cases and two adjacent private-list controls. Five Node contract
cases pass, including optional-field acceptance and invalid marker rejection.
Static TypeScript, targeted formatting, both production guard script syntax
checks and the owned diff whitespace check pass. These are finite simulated
client/contract checks, not browser or production-Worker execution.

All focused files and logs remain in `tmp/account-availability-proof/`.
Before/after test bytes are identical; later formatting has a separate final
source snapshot. The handoff manifest covers nineteen owned files:

- `handoff.json`:
  `22c5ff807e0a470a1fad798362d2b25ede2c08f4e007bd617876ce27ded71045`.
- `final/sources.json`:
  `a5df08eda285fa9cb594f81f00c4b94a9a48b0a73bb823ef45d6c0c3711762ad`.
- `final/metadata.json`:
  `681ba03650a1e6b8d8e7045547374adacc498dfc409d111157a1833309aa699d`.

## Combined proof still pending

Two native serialization cases cover both dedicated and shared handshakes.
The real IndexedDB guard suite retains its original 105 assertions and adds
twelve checks for the fixed failed marker or its omission on successful boot:
117 authored checks in total. They have not run for this addition yet.

The required root/web gates, real Worker conformance, real interface smoke,
focused failure-state screenshots, the maintained `pnpm accounts:check`
command and production storage inspection remain pending. They must bind the
new package; earlier WASM hashes are historical evidence for the earlier
checkpoint. The shipping pipeline has separate [local proof](engine-shipping.md).
No current public-network or successful live-deployment claim follows from
the focused checks above.
