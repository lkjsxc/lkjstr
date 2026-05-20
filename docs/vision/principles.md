# Principles

## Purpose

Principles define durable collaboration and implementation preferences.

## Clarity

Prefer explicit names, direct documentation, and visible ownership. Avoid
structure that requires hidden context to understand.

## Small Pieces

Keep source files at or below 200 lines where practical. Split by responsibility
before files become difficult to review.

## Verifiable Work

Every meaningful change should have a repeatable verification path. If no
automated check exists yet, state that clearly in the handoff.

## Respect For Existing Work

Do not overwrite or revert unrelated edits. Work with the current tree and keep
changes scoped to the requested area.

## Documentation First

Write durable intent before expanding implementation. Documentation should make
future code easier to review, not merely describe code after the fact.
