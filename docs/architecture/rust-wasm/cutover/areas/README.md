# Cutover Areas

## Purpose

This subtree splits wide implementation-ledger rows into small area contracts.
Status: partial; these files guide edits and do not permit deletion by
themselves.

## Table of Contents

- [storage.md](storage.md): protected storage, event cache, feed evidence,
  retention, repair, pressure diagnostics, and Stats storage state.
- [relay.md](relay.md): Rust relay reducers, browser host effects, budgets,
  leases, progressive snapshots, and cleanup.

## Rule

The parent [implementation ledger](../implementation-ledger.md) remains the
summary board. Area files add edit targets and acceptance checklists. A partial
area never allows TypeScript or Svelte deletion without the
[deletion ledger](../deletion-ledger.md) proof.
