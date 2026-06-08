# Autonomous Decision Defaults

## Purpose

This record gives implementation agents safe defaults when no human answer is
available. The defaults unblock planning without allowing fake product behavior
or premature deletion.

## Defaults

| Question | Default |
| -------- | ------- |
| Should product logic be deleted from SvelteKit after Rust parity? | Yes. Delete it after real behavior, tests, ledger evidence, and no-import proof. |
| Should root app boot move to Rust/WASM after shared surfaces are complete? | Yes. The root route boots the Rust/WASM workspace once the shell and surface gates pass. |
| Should local unprotected signer storage remain usable? | Yes, but it is visibly risky and migratable to protected storage. |
| Should NIP-17 encrypted DMs be implemented before feed cutover? | No. Implement DMs after storage, relay, signing, and feed foundations. |
| Should NIP-29 be mixed with NIP-28 Public Chat? | No. Keep relay-scoped groups separate from NIP-28 channel chat. |
| Should unsupported browser security features silently degrade? | No. Show explicit unsupported states. |
| Should fake relay data be used for UI polish? | No. Use synthetic data only in tests. |

## Application Rule

Use these defaults only when human input is unavailable. If a default affects a
product contract, update the relevant docs, implementation, tests, and ledgers
in the same change.
