# Background

## Purpose

This directory owns cancellable, owner-scoped background work helpers for
storage, relay, optimizer, hydration, retention, and diagnostics tasks.

## Table of Contents

- `task-types.ts`: task, priority, event, and snapshot types.
- `task-queue.ts`: bounded task queue factory.
- `cancellation.ts`: cancellation error and helpers.
- `yield.ts`: portable yield checkpoint.
- `errors.ts`: error serialization helpers.

## Contract

Factories return plain handles with idempotent cleanup. Every task has an owner,
abort signal, checkpoint, bounded diagnostics, and explicit queue outcome.
