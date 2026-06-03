# Orchestration Surface Inputs

## Purpose

Surface inputs define which evidence may be shared and which evidence must stay
isolated across tabs and feed types.

## Shared Inputs

Matching Home tabs may share one query and reuse relay score, scan density,
route, cache, and hydration evidence when account, selected relay set, page
size, and feed policy match.

Global tabs may share selected-relay evidence with other Global tabs, but they
must not inherit Profile route-group targeting.

## Isolated Inputs

- Profile route-group scans may reuse route-fingerprint-compatible evidence, but
  they must not contaminate Global.
- Notifications use independent semantic keys and do not inherit Home context.
- Thread context and exact id reads keep exact semantics.
- Search, metadata, follow-list lookup, Author Context, and reference
  resolution keep their documented request shapes.

## Cache Inputs

Complete coverage must match semantic feed key, route group, relay URL, filter
shape, direction, and bounded interval. Dense, incomplete, failed, stale,
missing, compacted, or expired rows cannot prove absence.

## Geometry Inputs

Row geometry uses stable content features and surface row kinds. It may share
across compatible width and font buckets, but not across transient owner ids.

## Host Inputs

Browser host state includes visibility, focus, viewport size, storage mode,
request budget caps, and explicit unavailable provider states. Host inputs are
read-only evidence for pure reducers.
