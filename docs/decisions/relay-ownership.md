# User-Owned Relay Configuration

## Purpose

This decision records relay ownership and hidden relay policy.

## Decision

Users own the relays that drive reading, publishing, and monitoring. The app
may seed a starter set when no relay configuration exists, but saved user relay
sets define runtime behavior.

## Consequences

- Relay scope must be visible in timelines, Tweet publish controls, and monitor
  views.
- Empty states must identify whether filters or relay selection caused the result.
- Publish success is measured per relay, not globally.
- Relay health is local evidence and must not become hidden global policy.

## Rejected Direction

The app will not hard-code a permanent universal relay list as the silent source of truth.
