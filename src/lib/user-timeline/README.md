# User Timeline

## Purpose

User Timeline modules own public target timeline author derivation, route keys,
cache reads, and relay-backed page loading.

## Table of Contents

- `user-timeline-state.ts`: runtime state contracts.
- `user-timeline-authors.ts`: target plus followee author sets.
- `user-timeline-route-plan.ts`: semantic route fingerprints.
- `user-timeline-cache.ts`: cache helpers.
- `user-timeline-loaders.ts`: initial and older page loaders.
- `user-timeline-runtime.ts`: cache-first target follow graph orchestration.

## Rules

The runtime renders real follow-graph feeds when the target kind `3` is found,
or real target-authored posts in degraded mode when the follow graph is absent
or still being discovered.
