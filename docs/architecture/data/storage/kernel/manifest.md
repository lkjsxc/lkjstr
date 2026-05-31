# Storage Manifest

## Purpose

The Storage Manifest is the executable table contract. It prevents future
agents from editing Dexie schema, docs, inventory groups, and retention policy
as separate truths.

## Manifest Fields

Each live table entry contains:

```text
name
dexie schema string or null
data class
inventory group
primary owner
ledger resource kind when compactable
protected-by-default flag
repairable flag
compactable flag
```

`null` schema strings are allowed only for removed-store cleanup outside the
live table manifest. Live object stores always have a Dexie schema string.

## Consumers

The manifest drives or verifies:

- Dexie `stores()` shape.
- Known table names.
- Inventory groups.
- Storage docs table.
- Stats grouping.
- Retention eligibility.
- Ledger resource coverage.
- Repair collector coverage.
- Delete dispatcher coverage.
- Repository boundary checks.

## Invariants

No live table may classify as `unknown`. Runtime diagnostics may report missing
stores as unavailable, but missing stores do not prove protected records can be
deleted.

Every compactable table has exactly one ledger resource kind, a byte estimator,
a target-state resolver, a delete dispatcher, a repair collector, and tests.

Every protected table has an owner module and stays outside cache pressure.
Protected safety rows, including relay route blocks, are reported as protected
safety pressure rather than recoverable diagnostics.
