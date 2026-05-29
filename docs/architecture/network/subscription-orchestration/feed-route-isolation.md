# Feed Route Isolation

## Purpose

Define how Home, Profile, Notifications, and tool reads avoid sharing cursor,
lease, or route state across incompatible relay plans.

## Contract

Feed runtimes submit intent only. Subscription orchestration owns relay
planning, route fingerprints, semantic read keys, live lease identity, and owner
channel lifecycle.

## Route Fingerprints

- A route fingerprint is derived from the resolved route groups, their relays,
  authors, keys, and route source.
- Route-group-backed page reads include the resolved fingerprint in the semantic
  key before they call the relay scanner.
- Selected-relay tool reads keep selected-relay semantic keys unless they move
  to planned route groups.
- Fingerprints are not owner ids. Owner ids affect lifecycle; fingerprints
  affect compatibility.

## Semantic-Key Inputs

Home initial scan:

- account pubkey
- selected relay set
- feed policy
- page size
- route generation when resolved
- route fingerprint when route-group-backed
- cursor bounds

Home live notes:

- account pubkey
- channel `notes`
- route fingerprint
- startup-bounded `since`
- owner visibility
- route generation

Profile posts:

- target pubkey
- route fingerprint
- cursor bounds
- page size
- explicit selected-relay fallback state

Notifications:

- active account pubkey
- filter kind and purpose
- selected or notification relay set
- cursor bounds
- no Home or Profile route fingerprint

Selected-relay tools:

- selected relay set
- validated filters
- purpose
- no route fingerprint unless explicitly route-planned

## Route Purpose

- Home and Profile post reads use author `write` routes because authored notes
  are expected on relays the author publishes to.
- Notifications use the active account's author `read` routes because `#p`
  activity is expected on relays the account reads from.
- Global, Search, and Custom Request stay selected-relay based unless a future
  contract explicitly gives them route-planned groups.

## Home

- Initial Home reads may use selected fallback while route evidence is still
  being discovered.
- Route refresh has its own generation. Stale refresh completions cannot clear
  rows, reload pages, or reopen live leases.
- When the Home notes route fingerprint changes, orchestration replaces only the
  `notes` live channel.
- Replacement live filters use `since = max(0, startedAt - 30)`.
- Visible rows remain in place during live lease replacement.

## Profile

- Profile post reads use target-author route groups planned by orchestration.
- Profile content route groups exclude discovery relays unless a discovery URL
  is explicitly selected by the user.
- When targeted author write routes exist, Profile paging does not append the
  selected fallback group.
- Profile live posts use the same route-planned relay set as Profile content
  reads. The runtime supplies pubkey, owner, visibility, and filters only.

## Notifications

- Notification `#p` reads and live tails remain scoped to the active account.
- Notification semantic keys do not reuse Home or Profile route fingerprints.
- Route evidence from Home or Profile cannot change a notification cursor or
  `#p` live lease.

## Tools

- Search and Custom Request remain tool-isolated selected-relay reads.
- Future route-planned tool reads must add a resolved route fingerprint before
  sharing semantic page keys.

## Related

- [page-read-dedupe.md](page-read-dedupe.md)
- [route-plan.md](route-plan.md)
- [routing-by-surface.md](routing-by-surface.md)
- [../../../operations/feed-route-isolation-regression.md](../../../operations/feed-route-isolation-regression.md)
