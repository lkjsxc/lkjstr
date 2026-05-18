# Readiness

## Purpose

Readiness checks whether the app contract is shippable.

## Checklist

- Docs and implementation agree.
- New Tab has no retired choices or free-form inputs.
- Settings are flat.
- Relay changes restart active read runtimes.
- Timeline handles Account home authors, cached data, EOSE, failed relays, no
  active account, no follow list, auth-required, subscription-closed,
  no-enabled-relay, ready-empty, and ready-with-events.
- Timeline and Relay Monitor expose relay diagnostics instead of hiding relay
  failures behind public fallback reads.
- Tweet publishes only with NIP-07 and enabled write relays.
- Docker config contains no bind mounts.
- Unit and e2e checks pass for the changed surface.
