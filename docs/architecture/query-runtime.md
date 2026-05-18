# Query Runtime

## Purpose

Query runtime docs define how cache-first relay reads behave.

## Contract

- Cache is read before relay subscriptions start.
- Relay reads use enabled read relays from the selected default relay set.
- Empty enabled-relay lists produce a visible no-enabled-relay state.
- Runtimes close their relay subscriptions when the owning tab unmounts.
- Runtimes ignore events for other subscription ids.
