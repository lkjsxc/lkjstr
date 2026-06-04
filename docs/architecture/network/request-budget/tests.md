# Request Budget Tests

## Purpose

Request-budget tests prove that local safety bounds improve relay behavior
without changing result correctness.

## Unit Gates

- NIP-11 parsing keeps valid top-level fields and typed limitation fields.
- Unknown NIP-11 fields are ignored.
- Invalid optional fields are omitted without throwing.
- Fetch success stores available records.
- Fetch failure stores unavailable records.
- Memory relay-information cache stays bounded.
- Missing NIP-11 metadata uses app hard caps and no false policy claim.
- `max_limit` clamps filter limits.
- `default_limit` creates explicit limits when needed.
- `max_message_length` rejects oversized `REQ` messages locally.
- `max_subscriptions` constrains active per-relay reads.
- `max_subid_length` keeps relay-facing ids within cap.
- Auth, payment, and restricted-write flags create diagnostics.
- Exact lookup, Search, Custom Request, and live semantics are preserved.
- Dedupe uses effective options and effective filter shape.
- Rust `lkjstr-relays` tests cover pure budget derivation, warning kinds,
  filter clamping, read-cap merge, and serialized `REQ` byte caps.

## Component And Projection Gates

- Relay Settings projection displays real NIP-11 info, stale state, failures,
  limitations, and policy warnings.
- Stats projection displays request caps, clamp reasons, relay statuses, and
  EOSE/OK counters without raw payload exposure.
- Search reducers keep NIP-50 filter semantics and relay support diagnostics.
- Custom Request reducers show user input and effective outbound request
  separately.
- Relay orchestration tests prove one failing relay does not block a reachable
  relay for Home or Global.

## Final Gate

Docker Compose remains authoritative:

```bash
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm app-smoke
```
