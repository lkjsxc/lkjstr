# Integration release

## Purpose

Record the 2026-11-15 integration candidate and remaining release blockers.

## Integration state

The engine/polish-20261115 branch changes are applied to this worktree.
A real git merge could not run: linked-worktree metadata is outside the
permitted worktree and read-only. No commit was made, per the explicit rule.
The frontend-owned protocol.ts remains unchanged at protocol 2. No visible
frontend layout, styling or wording was edited.

## Engine behavior

Protocol 2 supports account creation and explicit account.key backup as nsec.
Nonlocal signers refuse backup with unsupported; absent accounts use not-found.
Account creation commits private state before announcing the account. Secret
payloads are redacted from Rust debug output and conformance validator errors.
Native tests cover export, refusal and diagnostic/error redaction. Browser
checks create an account through Accounts and reopen its masked backup key.

Unknown profile counts are absent. Known counts use the existing partial flag;
successful, untruncated, verified relay answers establish exact counts. Visible
note count requests batch 120 IDs with 200-event pages and release with views.
Empty/failed/timed-out/truncated responses and count-only updates have tests.
Observed untrusted zap receipts keep counts partial pending trust validation.

Visitor relay editing and persistence now pass through Settings, including a
reload, on main eb722771. The earlier account-only frontend guard is fixed.

## Signer follow-up

The browser conformance harness now exercises account.key. Explicit local
backup returns nsec; extension backup is unsupported and missing accounts return
not-found. Secrets are validated in memory and erased from failure diagnostics.

The real-engine smoke injects window.nostr before load. Discovery and signing
rejection return signer-refused; nonresponse reaches the real 60-second deadline
and returns protocol code signer-missing. Navigation/input stay usable and a
failed send retains its draft and retry control. The ordinary extension path
still signs in, posts, reacts and signs out through the interface.

The encrypted loopback bunker covers connect without a token, required-token
refusal/success, signing, reload without reconnect authorization, signer refusal,
disappearance during an outstanding signing request, and retry after recovery.
Reload keeps the same device public key. Account removal is confirmed
through the interface and survives reload. No bunker URL, token or device
credential is written to interface storage or diagnostics.

Remote RPC errors previously collapsed to a generic signing refusal, including
an unavailable bunker. The Worker now preserves signer-missing/signer-refused,
and rejects promptly once all RPC sockets close. All sockets are still released
on success, refusal and timeout; one failed relay cannot cancel another live one.

Six native pagination tests pass with the review fixes and fail against all five
scheduler files from fc3cf32a's parent. They prove original-filter replay before
EOSE, historical coverage/cursor retention after short live resumption, continued
scrolling into history, and repeated disconnect/reconnect. Mutation was confined
to this worktree and all five files were restored byte-for-byte. Evidence:
tmp/preemption-regression.json, preemption-old.log and preemption-current.log.

## For the frontend

- Flush the current composer text before reload/pagehide, or save it immediately
  on input. A rapid NIP-07 rejection followed by reload can beat the 300 ms
  debounced save and lose the draft. The real smoke retains this failing check;
  the text remains intact before reload, and the timeout/reload variant passes.
  See web/src/views/compose.ts and tmp/signer-reject-sign.json (booleans only).

## Verification

check:repo, test:quiet, rust-wasm:quiet, verify:quiet and web check pass.
engine-check passes all 57 conformance checks and its delayed-profile probe.
smoke:real passes 71/72 checks with no page errors; only the deterministic
rejected-send/reload draft check fails. The page clock pauses inside the 300 ms
save window while Worker timeouts use real time. Results are recorded in
tmp/gates.json and tmp/gate-*.log.
The real-engine and conformance reports are tmp/smoke-real/report.json and
tmp/engine-harness/report.json. The draft persistence failure is kept as a release
blocker; engine-only changes cannot repair the frontend debounce policy.
All runs use fresh browser data, fresh loopback ports and intercepted HTTP.
Docker, deployment, production access and public-relay tests are excluded.
No commits, CI edits, existing-service restarts or reader-visible edits were made.
