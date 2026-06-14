# Mine npub

## Purpose

Mine npub generates a vanity local signing key whose public key has a requested
`npub1` prefix.

## Contract

- Mine npub opens from New Tab.
- The prefix field accepts only prefixes accepted by the account miner parser.
- Mining runs in a worker-backed process and reports attempts, rate, and
  elapsed time.
- The user can cancel an active run.
- A found result exposes copy actions for `npub` and `nsec`.
- Copy actions report clipboard unavailable or rejected writes explicitly; they
  show copied status only after the browser clipboard write resolves.
- Adding the mined signing account requires explicit user action after a match
  is found.
