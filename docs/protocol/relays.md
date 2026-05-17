# Relay Pool

Owner: Protocol
State: Canon

## Role

The relay pool owns browser WebSocket connections to user-configured relays. It turns workspace and pane demands into subscriptions, publishes, and monitor signals.

## Relay Configuration

A relay record contains:

- URL.
- User label.
- Enabled state.
- Read flag.
- Write flag.
- Last connection state.
- Last error code.
- Last successful event time.
- Health counters.

The product must support multiple named relay sets. A pane may use the default account relay set or an explicit pane relay set.

## Connection Policy

- Open connections lazily when a subscription or publish requires them.
- Reuse one WebSocket per relay URL.
- Back off reconnect attempts after repeated network failures.
- Close connections for disabled relays after active work drains.
- Keep monitor state available after disconnect.

## Subscription Policy

- Deduplicate equivalent filters across panes where possible.
- Preserve pane ownership so events can be routed back to interested panes.
- Use bounded limits for initial fetches.
- Separate initial catch-up from live continuation.
- Allow pausing a pane to release live subscriptions without deleting cached events.

## Publish Policy

Publishing is per relay. A publish request returns a result for each target relay:

- accepted.
- rejected with relay reason.
- failed due to connection or timeout.
- skipped because relay is disabled or not writable.

Partial success is normal and must be represented in UI and cache.

## Monitor Signals

The relay pool emits monitor records for:

- connection open, close, error, and retry.
- round-trip latency samples.
- subscription open and close.
- event received.
- event published.
- relay notice.
- relay rejection.
