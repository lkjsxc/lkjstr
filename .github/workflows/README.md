# Workflows

## Purpose

This directory contains GitHub Actions workflows for repository checks.

## Table of Contents

- `ci.yml`: repository, docker-final, and publish jobs.
- The repository job runs cheap host guardrails only.
- Docker Compose build and run steps use `--progress quiet`.
- Publish pushes the `app` image target after `docker-final` passes.

Keep workflow commands aligned with
[docs/operations/verification.md](../../docs/operations/verification.md).
