# CHECK-002 Product Fixture Import Guard

## Purpose

Prevent test fixtures, mocks, sample data, and dummy data from entering product source imports.

## Status

implemented

## Current Evidence

- commit `9bb4538d` added `checkProductFixtureImports` and focused tests

## Next Edit

Extend the guard only when a real product leak pattern is found.

## Files To Read

- docs/agent/no-fake-data.md
- scripts/repo-product-fixtures.ts

## Files To Touch

- scripts/check-repo.ts
- scripts/repo-product-fixtures.ts
- tests/unit/repo-product-fixtures.test.ts

## Focused Gate

```sh
pnpm test -- tests/unit/repo-product-fixtures.test.ts
pnpm check:repo
```

## Acceptance

Product source under `src/` cannot import test, fixture, mock, sample, or dummy paths.

## Must Not

- Do not block test-only fixture imports.
- Do not use broad string scans that catch prose.
