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

Visitor relays.save accepts an empty account and validates the complete list.
The existing startup adapter persists confirmed edits under the visitor key.
Settings still blocks the action before it reaches the Worker. The real smoke
attempts the interface edit and requires it to survive reload; this requirement
remains a release blocker, without bypassing the interface in the test.

## For the frontend

Allow bootstrap relay edits in settings-relays.ts without the account-only
note-actions.act guard. Send relays.save with as set to the empty string while
signed out. Engine support and confirmed-edit persistence are present.

## Verification

All four root gates pass: check:repo, test:quiet, rust-wasm:quiet, verify:quiet.
Frontend check, build and smoke pass. smoke:real has 30 passing checks, no page
errors, and fails at the signed-out relay edit. Its reload assertion cannot run.
The blocked edit is a product failure, not a network failure; the gate is intact.
Reports and individual gate logs are in ignored tmp/.
The real build is packaged at tmp/lkjstr-dist.tar.gz for review, not release.
Docker, deployment, production access and public-relay tests are excluded.

Candidate: 760252 bytes; SHA-256:
38d59d49bf5e4cb311ea14061782133030d3f95476325d39d881d2d3e551a486
