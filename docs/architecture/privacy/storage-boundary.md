# Consent Storage Boundary

## Purpose

This file defines how privacy consent is persisted without weakening local-first
storage.

## Contract

The consent record is essential local storage because it records whether optional
processing is allowed. The adapter stores only category booleans, a schema
number, and an update timestamp. It does not store accounts, relay rows, event content,
drafts, diagnostics, or signing secrets.

The adapter handles blocked localStorage explicitly. If a save fails, the UI
keeps optional categories disabled and shows a save failure. It must not silently
turn optional processing on.

Withdrawal clears optional adapter-owned data:

- optional cookies created by lkjstr.
- localStorage keys with the optional privacy prefix.
- future optional telemetry queues owned by the privacy adapter.

Withdrawal does not delete OPFS SQLite product data or required workspace local
state.
