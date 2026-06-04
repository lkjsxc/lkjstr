# Tests

## Purpose

This directory owns focused Vitest unit and integration coverage for repository
contracts.

## Table of Contents

- `helpers/`: shared protocol-shaped fixtures and synthetic relay helpers.
- `unit/`: focused tests grouped by owning module.

## Rules

- Keep each test file under 200 lines.
- Prefer many small tests over one broad suite.
- Put behavior near the owning reducer, repository, factory, or projection.
- Product code must not depend on test fixtures or fake records.
