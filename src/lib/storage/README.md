# Storage

## Purpose

This directory contains browser database and safe storage adapters.

## Table of Contents

- IndexedDB schema and storage fallback wrappers.
- Storage inventory estimates for Stats diagnostics.
- `tabStates` rows are keyed by `workspaceId + tabId`; old pane-keyed rows are
  ignored by load and cleaned during workspace snapshot cleanup.
