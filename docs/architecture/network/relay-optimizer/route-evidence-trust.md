# Route Evidence Trust

## Purpose

Route evidence ranks targeted relay attempts for author and event-specific
reads. It never removes the selected-relay fallback and never changes Global,
which remains selected-relay based.

Status: Rust owns the pure trust reducer in
`crates/lkjstr-relays/src/route_evidence/` and route planning now sorts by
source trust before per-route score. Product discovery wiring and Stats rows are
still open.

## Trust Sources

| Source                       | Trust                    | Rules                                   |
| ---------------------------- | ------------------------ | --------------------------------------- |
| selected user relay          | correctness fallback     | included unless disabled or removed     |
| measured event receipt       | strongest measured route | real event seen on relay                |
| measured author read success | strong targeted route    | recent successful author read           |
| local discovery success      | medium-to-strong         | repeated real reads improve rank        |
| event or entity relay hint   | medium                   | useful seed for bounded attempts        |
| NIP-65 kind `10002`          | weak prior               | discovery seed only                     |
| timeout, auth, close, error  | negative                 | lowers route rank, not proof of absence |
| repeated no-yield read       | weak negative            | decays targeted confidence              |

## NIP-65 Rules

- NIP-65 data comes only from real `kind:10002` events.
- NIP-65 suggestions stay separate from Relay Settings until the user imports
  them.
- Fresh NIP-65 can add bounded targeted attempts for the relevant author and
  purpose.
- NIP-65 alone cannot suppress selected fallback, prove absence, or rank above
  recent measured receipt/read success.
- Stale or repeatedly missed NIP-65 evidence decays below recent measured
  evidence.
- Disabled or removed relay URLs are excluded even when NIP-65 or measured
  success exists.

## Planning Order

1. Normalize and block disabled relays.
2. Build measured author route candidates.
3. Add bounded hint and NIP-65 candidates.
4. Score candidates by source trust, recency, measured relay read score, and
   URL tie-break.
5. Preserve fairness for weak but enabled routes within caps.
6. Append selected fallback groups after targeted groups.
7. Keep Global on selected read relays only.

## Diagnostics

Stats should show the source mix for current route plans:

```text
author prefix
relay URL
source
trust score
measured success count
measured failure count
last success
last failure
used in current route plan
```

Raw event payloads and full filters are not route diagnostics.
