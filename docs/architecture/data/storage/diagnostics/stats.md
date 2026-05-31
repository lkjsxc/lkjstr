# Stats Contract

## Purpose

Stats turns storage manifest, ledger, inventory, quota, and operation results
into a readable diagnostic surface.

## Groups

Stats groups bytes as:

- protected user data
- protected safety data
- physical object-store bytes
- ledger-accounted resource bytes
- prunable cache
- derived feed cache
- diagnostics
- cache metadata
- metadata
- non-IndexedDB storage
- unknown old or unowned storage
- residual browser overhead

## Required Fields

Stats shows browser usage, site budget, total ledger bytes, prunable ledger
bytes, protected estimates, localStorage bytes, Cache Storage bytes, overhead,
unknown or unowned bytes, inventory status, ledger rows by owner and resource
kind, physical rows by IndexedDB database and object store, last compaction
reason, deleted resource count, and deleted byte estimate.

Operation diagnostics distinguish durable success, unavailable storage,
timeout, quota failure, blocked storage, corrupt rows, and late-settled work.

## Action Contract

Stats exposes manual refresh, compact, and repair actions. Repair fixes missing
or stale ledger rows, deletes orphan ledger rows, removes safe unowned cache
rows, and deletes only old stores or databases classified as obsolete and
recoverable. Compact uses browser origin usage when available and keeps
deleting bounded batches of prunable ledger resources until the site budget is
met or a stop reason explains why it cannot continue.

## Rule

Stats must be useful when storage is degraded. It should report unavailable or
partial diagnostics instead of throwing or showing zero-byte success.
