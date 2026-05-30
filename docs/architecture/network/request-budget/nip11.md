# NIP-11 Budget Data

## Purpose

NIP-11 relay information is parsed into typed protocol data that can drive local
request bounds and relay diagnostics.

## Document Fields

The relay information parser keeps these top-level fields when valid:

- `name`
- `description`
- `banner`
- `icon`
- `pubkey`
- `self`
- `contact`
- `supported_nips`
- `software`
- relay software build string
- `terms_of_service`
- `payments_url`
- `limitation`
- `fees`

Unknown top-level fields are ignored. Invalid optional fields are omitted
without rejecting the whole document. Non-object documents are rejected.

## Limitation Fields

`limitation` is stored internally with camelCase names:

| NIP-11 field | Internal field | Use |
| --- | --- | --- |
| `max_message_length` | `maxMessageLength` | outbound `REQ` byte bound |
| `max_subscriptions` | `maxSubscriptions` | active per-relay read slot bound |
| `max_limit` | `maxLimit` | per-filter `limit` clamp |
| `max_subid_length` | `maxSubIdLength` | relay-facing subscription id bound |
| `max_subscription_id_length` | `maxSubIdLength` | accepted alias |
| `max_event_tags` | `maxEventTags` | diagnostic and write safety input |
| `max_content_length` | `maxContentLength` | diagnostic and write safety input |
| `min_pow_difficulty` | `minPowDifficulty` | policy diagnostic |
| `auth_required` | `authRequired` | policy diagnostic |
| `payment_required` | `paymentRequired` | policy diagnostic |
| `restricted_writes` | `restrictedWrites` | policy diagnostic |
| `created_at_lower_limit` | `createdAtLowerLimit` | read-bound diagnostic |
| `created_at_upper_limit` | `createdAtUpperLimit` | read-bound diagnostic |
| `default_limit` | `defaultLimit` | explicit-limit decision input |

Integer fields accept positive integers only except `supported_nips`, which
accepts non-negative integers. Boolean fields accept booleans only.

## Identity Fields

`pubkey` and `self` are kept only when they are lowercase 64-character hex.
Invalid values are omitted and recorded only through diagnostics if a caller
needs to display why a field is absent.

## Staleness and Failure

- Available records include `relayUrl`, `fetchedAt`, `status`, and `info`.
- Unavailable records include `relayUrl`, `fetchedAt`, `status`, and `error`.
- Stale records remain visible and may provide conservative local caps while a
  refresh is pending.
- Failed fetches are stored as unavailable so Relay Settings and Stats can show
  a real failure state instead of silently hiding metadata.
- Missing metadata is `unknown`; it must not suppress reads.
