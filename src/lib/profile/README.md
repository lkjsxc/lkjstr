# Profile

## Purpose

This directory contains profile tab runtime and state management.

## Table of Contents

- Profile loading, paging, metadata draft, and store helpers.
- `profile-runtime-paging.ts` owns post paging and private safe relay scan
  cursor handoff. Metadata and follow-list reads stay in initial loading.
- `profile-runtime-handlers.ts` owns receive/update helpers for live metadata,
  follow-list, and post events.
- `profile-route-plans.ts` owns Profile post read and live route planning.
