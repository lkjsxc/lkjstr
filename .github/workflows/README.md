# Workflows

## Purpose

This directory contains GitHub Actions workflows for repository checks.

## Contents

- `ci.yml`: verify, e2e, Compose, and publish jobs.
- Workflow commands use quiet verification (`pnpm verify:quiet`,
  `pnpm test:e2e:quiet`) so passing CI logs stay minimal.
- Playwright report and `test-results` artifacts upload only on e2e failure.
- Docker Compose build and run steps use `--progress quiet`.

Keep workflow commands aligned with
[docs/operations/verification.md](../docs/operations/verification.md).
