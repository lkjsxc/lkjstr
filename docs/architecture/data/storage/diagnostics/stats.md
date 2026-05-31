# Stats Contract

## Purpose

Stats turns storage manifest, ledger, inventory, quota, and operation results
into a readable diagnostic surface.

## Groups

Stats groups bytes as:

- protected user data
- protected safety data
- recoverable cache
- derived feed cache
- diagnostics
- ledger
- metadata
- non-IndexedDB storage
- browser overhead or unknown usage

## Required Fields

Stats shows browser usage, site budget, total ledger bytes, prunable ledger
bytes, protected estimates, localStorage bytes, Cache Storage bytes, overhead,
inventory status, ledger rows by owner and resource kind, last compaction
reason, deleted resource count, and deleted byte estimate.

Operation diagnostics distinguish durable success, unavailable storage,
timeout, quota failure, blocked storage, corrupt rows, and late-settled work.

## Rule

Stats must be useful when storage is degraded. It should report unavailable or
partial diagnostics instead of throwing or showing zero-byte success.
