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

## Combined production proof (2026-11-17)

Production checkpoint `c3e1baa8` kept all 1293 tracked source files unchanged
through its gates. The first five rows below use `5960c02d`; the sole later
change is one rustfmt line wrap in the failed-handshake call. Both native
serialization cases ran in the workspace gate. Builds/tests used four
jobs/threads and owned data; every stage left no owned process running.

| Stage | UTC start-end | Seconds | Load before; after (1/5/15 min) |
| --- | --- | ---: | --- |
| Shipping fixtures (19) | 01:18:16-01:18:26 | 9.279 | 6.17/5.92/5.28; 7.01/6.10/5.35 |
| check:repo | 01:18:26-01:18:27 | 1.215 | 7.01/6.10/5.35; 7.01/6.10/5.35 |
| web check | 01:18:27-01:18:37 | 9.971 | 7.01/6.10/5.35; 7.78/6.30/5.42 |
| web build | 01:18:37-01:18:38 | 0.564 | 7.78/6.30/5.42; 7.56/6.27/5.42 |
| Failure-state shots | 01:18:38-01:19:08 | 29.792 | 7.56/6.27/5.42; 5.59/5.91/5.32 |
| test:quiet | 01:22:07-01:24:00 | 112.928 | 4.86/5.45/5.25; 8.98/7.29/5.98 |
| rust-wasm:quiet | 01:24:01-01:26:22 | 141.290 | 8.98/7.29/5.98; 5.94/7.33/6.23 |
| verify:quiet | 01:26:22-01:28:58 | 156.258 | 5.94/7.33/6.23; 9.88/9.66/7.38 |
| Worker conformance | 01:28:58-01:34:48 | 349.668 | 9.88/9.66/7.38; 7.65/9.50/8.15 |
| web smoke | 01:34:48-01:41:42 | 413.963 | 7.65/9.50/8.15; 5.55/7.68/7.93 |
| build:real | 01:41:42-01:42:11 | 28.175 | 5.55/7.68/7.93; 6.75/7.73/7.94 |
| smoke:real | 01:42:11-01:51:06 | 535.090 | 6.75/7.73/7.94; 7.47/6.59/7.16 |
| package | 01:56:41-01:56:42 | 0.766 | 2.14/4.25/6.01; 2.14/4.25/6.01 |
| accounts:check | 01:56:42-01:57:19 | 36.639 | 2.14/4.25/6.01; 1.50/3.83/5.79 |
| Production storage | 01:57:19-01:57:20 | 1.126 | 1.50/3.83/5.79; 1.50/3.83/5.79 |

Main Worker conformance passed 459 checks, mock UI 418, uploads 131 and real
UI 541, without reported page errors. The maintained account command
audited current/older production exports, then passed twelve write-race checks
and all 117 strict-load/ownership checks. The original 105 assertions remain;
twelve additions verify failed markers or their omission on normal boot.
Storage passed nineteen checks. Account fixtures report zero page errors,
external requests or forbidden sockets, and every cleanup flag is true.

The production source manifest has SHA-256
`e8981632ba1a6a906176ab4a61cca2b8beed57a6c34b5d6671c59a8927347062`.
Frozen package: `tmp/shipping-release-artifacts/691c46c7975b938adb95/`.

- WASM: `2b7f0e4a9ab89a241b17cd39ddceb2e974eade593707f5494f82a3b66354f002`.
- Loader: `d69b6219eb9201b6b84c6579ff07ff1dd8b0993b026470a92e8351522fc1f179`.
- Archive: 1602120 bytes,
  `e6d19d21484de79df8181d4820eaf7a1d9483e360500a09fe2aad879370e7071`.

`tmp/shipping-release-final-c3e1baa8/evidence.json` binds each selected attempt,
source/artifact map, report and cleanup result; its SHA-256 is
`a9dd72254837a49137d36ee53a5193b1110777d160fa4c17226ad65e79478e38`.
Race, guard and storage report hashes are respectively:
`cf475d80b257be3491d01872947828c0f2a0fcde07a46bc7ce4d4fdf688f5afe`,
`9d5b831ac4901b21a71af96d269fbed8fa790fcfb0fb47287318c1b5821fa9d7`,
`585f39809ff7818cc2034e449fe10761a17a8a9a8e35b616ddef9ded83295f47`.

## Captures and corrected attempts

Twenty-four PNGs and twelve comparison sheets cover populated/guest Home at
1440/1024/390, both themes and languages, under
`tmp/screens-account-failure-20261117/`. Four sheets were visually reviewed:
`account-failure-contact-sheet-1440-dark-ja.jpg`, `1024-light-en.jpg`,
`390-dark-ja.jpg` and `390-light-en.jpg`, all with that same filename prefix.
Existing failure words are visible and populated Home retains its notes.
Deliberate capture scrolling does not prove reading-anchor preservation;
inactive Global is unmounted and is not claimed as retained evidence.
Capture manifest hash:
`e562e2cbfe18171160a037b2c40135a067d39258d1d3986bf8e7bf555cce6535`.
Visual review record `tmp/account-failure-review.json`:
`7c95a1cae3be4cc7a83982b227d8b11e8b50404f2642775cb618108d1bb8fb9f`.

The first fixture incorrectly required inactive tabs to stay mounted. Another
geometry assertion measured fractional padding rather than visible words;
the footer box exceeded the viewport by 0.28125 pixels. The final fixture
checks mounted Home and its text range. The first native gate stopped at
rustfmt before compilation; its formatting correction preceded the passed run.
Packaging initially stopped before its script ran because borrowed dependency
links shared pnpm workspace metadata. Private offline/frozen installs repaired
this without changing package manifests or locks. The retained isolation
report `tmp/dependency-isolation-20261117/report.json` has SHA-256
`7ac417446793d745b4110f835c333ccd239bd14e3a47aaeedb605fabc46e1984`.

## Rebase and remaining boundary

Rebase onto `07e88178` preserves the Rust/Worker implementation and incorporates
Claude's unused paired A1/A2 strings, new specifications and upstream shipping
authentication. The reconciled 23-case local shipping proof is recorded in
[engine-shipping.md](engine-shipping.md). Final web checking and a rebound
real package remain pending for this merged source. The older `04c10b9b`
production hashes remain historical evidence, not aliases for this package.
These finite checks do not establish current public-network completeness or
a successful live deployment.
