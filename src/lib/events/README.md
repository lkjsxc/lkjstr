# Events

## Purpose

This directory contains event repository, feed window, rendering support, and
write-action helpers.

## Table of Contents

- [event-order.ts](event-order.ts): canonical `compareEventsNewestFirst` for feeds.
- Repository implementations and shared storage adapters.
- Relay page scans, compound feed cursor ordering, durable feed coverage
  records, scan context helpers, and scan density model observations.
- Feed cursors, coverage, scan hints, and scan density rows are recoverable page
  cache and should register in `cacheLedger` when persisted.
- Content token, media, tree, zap, and scroll helpers.
- [publish-client-tag.ts](publish-client-tag.ts): opt-in NIP-89 tag enrichment before signing.
- [action-state.ts](action-state.ts) and [action-state-cache.ts](action-state-cache.ts): pressed Heart/Repost state.
