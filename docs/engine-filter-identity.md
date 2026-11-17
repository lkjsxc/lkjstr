# Exact relay filter identity

## Purpose

Q1 shares a logical relay read across views even when its OR selectors arrive
in a different order or contain repeated values. This change does not combine
different predicates, widen time spans or change page limits.

## Identity boundary

The network plan canonicalizes each incoming filter before route selection,
primary-route bookkeeping, request sharing, predecessor lookup and scheduling.
IDs, authors, kinds and each tag's OR values are sorted and deduplicated.
Absent selectors and present empty selectors remain different. Tag names,
search text, since, until and limit remain exact.

Public query construction keeps its existing representation. Priority compares
its canonical identity with the retained request, so a focused notification
read remains focused. Public page evidence lookups canonicalize their argument
once; internal route and predecessor comparisons use canonical retained filters.

Hydration/count family classification and generated buckets use the same sorted
kind arrays. Count completion accepts the existing unordered query shape.
No new retained collection, protocol field or visible interface is introduced.

## Ownership and verification

Equivalent views share one physical filter and its existing ownership set.
Closing one view or reopening it while another owner remains does not replay the
request. The last owner still releases the request and its evidence.

Native regressions cover sharing and closure, distinct predicate semantics,
focused classification, empty completion and a two-relay historical page where
the unfinished relay must retain its original cursor after selector reordering.
Unit cases preserve empty selectors, prefix selectors and all scalar bounds.

The focused native targets are engine_filter_identity_test and
engine_filter_identity_paging_test. Verification is pending integration; no
passing measurement or public-relay score is claimed here.
