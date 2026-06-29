# Privacy Architecture

## Purpose

This subtree defines local consent storage, optional processing boundaries, and
cleanup behavior.

## Table of Contents

- [storage-boundary.md](storage-boundary.md): essential consent storage and
  optional data cleanup.
- [optional-processing.md](optional-processing.md): category gates for cookies,
  telemetry, and non-essential storage.

## Contract

Privacy code is a browser host adapter around a pure consent reducer. Product
features may read the consent snapshot, but optional processing stays disabled
unless the reducer state explicitly enables the matching category.
