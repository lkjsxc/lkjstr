# Private cache proof

## Purpose

## Purpose and command

Measure the visible body of an owned encrypted-message fixture while relay
replay is withheld. This is separate from the public read-only account and
the two public usage hours. It does not replace either measurement.

~~~sh
pnpm cache:private --build=/absolute/path/to/frozen/dist
pnpm test:harnesses
~~~

The command requires an already built real package and never invokes Cargo.
Only one browser harness may run. The output directory must be fresh and
inside this worktree's tmp directory. No owner profile or account is used.

## Fixture boundary

The application bytes come from the supplied frozen build, with digests in
the report. A fresh local server preserves their body bytes, MIME and HTTP
cache policy. Its fixture CSP permits only same-origin resources and one
owned loopback relay. Images, media and fonts cannot use external origins.
The proxy rejects paths resolving to another origin. No public relay receives
a request, authentication message or publication from the application.

The browser generates two new keys. The test passes both through the real
encrypted export/import controls entirely inside that browser and protects
them with an owned fixture password. Neither a secret key nor an encrypted
key backup is returned to Node, printed or retained in the report. The only
Node account identifiers are the two generated public keys.

The peer sends one encrypted message to the reader through the owned relay.
The report checks that the relay receives encrypted wrappers and no plaintext
message envelope. Reading setup uses the actual compiled Worker and storage.
It does not inject decrypted rows into the UI or modify the event database.

## Measured sequence

1. Establish one visible inbox item and its conversation through existing UI
   controls. This proves the body was previously available.
2. Withhold relay EVENT replay, then close and reopen the inbox and
   conversation. Empty EOSE replies remain honest relay replies.
3. Lock the reader and assert that its body disappears from visible views.
   Reload and confirm the reader remains locked without visible plaintext.
4. Close the browser process and reopen the same owned profile against the
   same origin. Confirm the reader is still locked.
5. Unlock through the real action. Measure body paint from its acknowledgement;
   all work before that acknowledgement is excluded, including any archive
   restore/decryption already completed. Then close and reopen inbox/conversation
   again if the cached body is available.
6. Inspect durable public storage inside the browser. Only the boolean that
   fixture plaintext is absent and archive metadata leave the browser.

The body mark requires a subsequent animation frame with a visible matching
row. A cache claim additionally requires at most 100 ms and zero relay EVENTs
in that visit. Missing stored content stays unavailable. The probe does not
extend the success threshold when the cache misses.

This finite fixture records real loopback payload counters, but deliberate
replay withholding is not evidence of natural second/first traffic savings.
It measures message and inbox bodies; names, avatars, counts, drafts and
other protected views need their own evidence.

## Reports and cleanup

Each run preserves report.json and report.md, the frozen application files,
source/build digests, dates, load averages, boolean privacy checks and timing.
Failures retain only stage and error type, with no private DOM, screenshot,
key, backup or message body in diagnostics.

Signals interrupt the protocol and close owned browser/server/socket state.
Any failed resource close or browser-data deletion makes completion false.
Owned browser data is removed after success or failure. Other services and
profiles are untouched. A completed protocol may contain missed timing targets;
the report never equates completed execution with successful cache reuse.

As of 2026-11-17, this proof is implemented but browser calibration is pending
the shared browser reservation. Its unit checks do not certify actual private
message persistence or a measured improvement.
