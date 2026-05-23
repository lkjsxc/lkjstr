# Profile

## Purpose

This directory contains profile tab runtime and state management.

## Contents

- Profile loading, paging, metadata draft, and store helpers.
- `profile-runtime-paging.ts` owns post paging and private safe relay scan
  cursor handoff. Metadata and follow-list reads stay in initial loading.
