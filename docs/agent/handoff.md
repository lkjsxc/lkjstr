# Handoff

## Purpose

This file defines the evidence format for ending a slice: commit messages,
the final report, and honest verification claims. A handoff exists so the
next agent can continue without hidden context.

## Commit Evidence

Commit messages follow
[../repository/commit-protocol.md](../repository/commit-protocol.md): one
intent line, optional rationale, and trailers only when they add useful
constraints. `Tested:` and `Not-tested:` must match commands that actually
ran.

## Final Report Shape

A slice handoff names:

1. What changed and why, in one or two sentences.
2. Docs updated, with paths.
3. Ledger rows updated, with paths.
4. Commands run, with actual results.
5. Commands not run, with the reason.
6. The next executable step: the task or blocker, the files to read, the
   focused gate, and the acceptance condition.

## Honest Failure Reporting

- Quote the exact command and the relevant failure output tail.
- Classify every failure as a code failure or an environment failure.
- An environment failure, such as a missing tool, a sandbox limit, or a
  browser driver mismatch, does not prove code correctness. State what
  evidence is missing.
- Never record `Tested:` for a gate that did not run; record it under
  `Not-tested:` instead.

## Verification Ledger

When a Rust/WASM cutover area changed, append the actual commands and results
to
[../architecture/rust-wasm/cutover/verification-ledger.md](../architecture/rust-wasm/cutover/verification-ledger.md).
Record the Docker final gate as run or not run; never as assumed.

## Product Truth Check

Before handing off a product-behavior change, run the pre-handoff audit in
[no-fake-data.md](no-fake-data.md).
