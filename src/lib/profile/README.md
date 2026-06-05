# Profile

## Purpose

This directory contains profile tab runtime and state management.

## Table of Contents

- Profile loading, paging, metadata draft, and store helpers.
- `followees.ts` extracts deduplicated valid `p` tags for Followees tabs.
- `profile-runtime-paging.ts` owns post paging and private safe relay scan
  cursor handoff. Metadata and follow-list reads stay in initial loading.
- `profile-runtime-handlers.ts` owns receive/update helpers for live metadata,
  follow-list, and post events.
- `profile-runtime-loaders.ts` owns older/newer runtime page transitions.
- `profile-route-plans.ts` owns Profile post read and live route planning.
