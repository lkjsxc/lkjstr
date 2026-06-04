# Workflows

## Purpose

This directory contains GitHub Actions workflows for repository checks.

## Table of Contents

- `ci.yml`: verify, Compose, and publish jobs.
- Workflow commands use quiet verification so passing CI logs stay minimal.
- Docker Compose build and run steps use `--progress quiet`.
- Publish builds the `app` image target after verification jobs pass.

Keep workflow commands aligned with
[docs/operations/verification.md](../../docs/operations/verification.md).
