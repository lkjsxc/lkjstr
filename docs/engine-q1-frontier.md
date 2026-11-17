# Logical page frontiers in shared envelopes

## Purpose

Keep each logical filter's history quota independent when finite filters share
one physical relay request. This is correctness groundwork for the read plan;
it does not enable live-envelope merging or claim that Q1 is complete.

## Reproduction

A shared envelope asks for the latest two events from authors A and B, and the
latest two from A. The broad result is A at time 100 and B at 99. The narrow
result adds A at time 1. B also has an event at 90 that neither first answer
contains.

Every received event is matched against every logical filter in the envelope.
Previously the broad request stopped counting IDs at its limit but continued
lowering its oldest timestamp. The narrow result could therefore lower the
broad cursor to 1. Continuing at that cursor skipped B's unseen event at 90.

The failure is independent of relay response order. It can also occur after
the narrow owner closes: the immutable finite envelope remains alive for the
broad owner until its completion.

## Evidence and lifetime

Each logical request now retains the newest L distinct matching IDs with their
timestamps. L is the actual transmitted limit after the relay's limit is
applied; the relay limit is clamped to 200. The oldest retained timestamp is the
request's continuation frontier. Older extra matches still enter the shared
verification/store path, but cannot move that request past its quota.

Equal timestamps retain an inclusive boundary. Duplicate IDs cannot occupy two
positions or replace their recorded timestamp. No new exhaustion rule is
introduced. A short response still retains every matching ID for the existing
verification and absence checks.

The frontier replaces the old received-ID collection and preserves its
len/iteration/clear/clone operations. Retries clear all evidence where they
already cleared received IDs; a carried pending page clones the whole frontier.
Verification queue loss clears it for every member of the affected envelope,
revokes completion and retries the original span after the backlog drains.
Stale EOSE messages cannot complete a replacement wire.

This changes neither signature verification nor the authority of raw receipt
metadata. Full-page evidence remains a lower bound; invalid or dropped
verification does not acquire new authority.

## Verification

The focused integration target is engine_q1_frontier_test. Its fixture uses
signed events and the real core scheduler against an in-memory relay model:

- A broad/narrow envelope with relay max_limit=2 obtains the intermediate event
  through the actual continuation filter, for both arrival orders.
- Duplicate delivery retains independent quotas and frontiers.
- Closing a finite sibling neither closes nor replays the surviving wire.
- A rejected envelope establishes no completion and retries with fresh evidence.

Native module tests cover newest-L ordering, equal timestamps, cloning,
clearing, zero quota and verification-drop replay.

The main regression can be copied unchanged to the parent revision, together
with engine_q1_frontier_support, to reproduce the missing intermediate event.
No new helper API is required by those integration tests.

## Scope

This frontier fix does not choose live-envelope lifetimes. The coordinated
public-union candidate is described in [cover.md](cover.md), including its open
bounded-retirement requirement. A relay cannot selectively remove one logical
selector from a live envelope. Historical completion remains per filter: a
saturated broad Home response does not establish a narrow profile's history.

No interface, strings, layout, persistence format or public protocol changes
are part of this fix. Runtime and verification evidence must be recorded by
the coordinated gate run before this work is described as shipped.
