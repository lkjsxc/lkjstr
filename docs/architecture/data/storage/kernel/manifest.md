# Storage Manifest

## Purpose

The Storage Manifest is the executable logical table contract. It prevents
agents from editing schema docs, inventory groups, and retention policy as
separate truths.

## Manifest Fields

Each live table entry contains:

```text
name
data class
inventory group
primary owner
ledger resource kind when compactable
protected-by-default flag
repairable flag
compactable flag
```

SQLite table shape lives in typed repository schema modules. The manifest owns
logical storage families and policy, not raw SQL text.

## Consumers

The manifest drives or verifies:

- known logical table names;
- inventory groups;
- storage docs table;
- Stats grouping;
- retention eligibility;
- ledger resource coverage;
- repair collector coverage;
- delete dispatcher coverage;
- repository boundary checks.

## Invariants

No live table may classify as `unknown`. Runtime diagnostics may report missing
tables as unavailable, but missing tables do not prove protected records can be
deleted.

Every compactable table has exactly one ledger resource kind, a byte estimator,
a target-state resolver, a delete dispatcher, a repair collector, and tests.

Every protected table has an owner module and stays outside cache pressure.
Protected safety rows, including relay route blocks, are reported as protected
safety pressure rather than recoverable diagnostics.
