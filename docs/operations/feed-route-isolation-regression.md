# Feed Route Isolation Regression

## Purpose

Track verification for feed route isolation across Home, Profile,
Notifications, and selected-relay tools.

## Matrix

| Risk                       | Unit evidence                                      | Browser evidence                       | Status        |
| -------------------------- | -------------------------------------------------- | -------------------------------------- | ------------- |
| Cross-surface cursor bleed | Profile/Home page keys differ by route fingerprint | Home/Profile/Notifications together    | open question |
| Stale route refresh        | Old Home refresh cannot clear rows or replace live | Home receives after route refresh      | open question |
| Hidden-tab interference    | Hidden owners pause without closing visible leases | Hidden tab keeps visible live intact   | open question |
| Duplicate live leases      | Home notes channel replaces instead of stacking    | Multiple Home tabs avoid duplicates    | open question |
| Missing refresh events     | Replacement live uses startup-bounded `since`      | Home receives discovered-route events  | open question |
| Discovery relay post bleed | Profile posts exclude discovery unless selected    | Profile route-isolation scenario       | open question |
| Notification route bleed   | `#p` reads are isolated from Profile/Home routing  | Notifications cursor stays independent | open question |
| Scan batch key collision   | Relay scan keys include group identity             | Covered by grouped feed scenarios      | open question |

## Unit Gates

- Route fingerprint changes alter planned page semantic keys.
- Profile content route groups exclude discovery relays unless selected.
- Profile paging skips selected fallback when author routes exist.
- Home route refresh replaces only the notes live channel.
- Relay scanner batch keys include a sanitized group identity.
- Owner lifecycle and surface semantic keys remain separate concerns.

## Browser Gates

- Home/Profile/Notifications opened together do not share visible cursor state.
- Home live receives events after discovered-route refresh.
- Hidden Home or Profile tabs do not close visible matching live leases.

## Commands

- `pnpm test -- tests/unit/relays/orchestration/page-reads.test.ts`
- `pnpm test -- tests/unit/profile/profile-runtime-paging.test.ts`
- `pnpm test -- tests/unit/timeline/timeline-runtime-route-discovery.test.ts`
- `pnpm test:e2e -- tests/e2e/subscription-three-home.spec.ts`
- `pnpm test:e2e -- tests/e2e/subscription-lease-sharing.spec.ts`
- `pnpm test:e2e -- tests/e2e/timeline-multi-tab.spec.ts`
- `pnpm test:e2e -- tests/e2e/timeline-regression.spec.ts`

## Latest Evidence

- `pnpm check:repo`
- `pnpm test -- tests/unit/relays/orchestration/page-reads.test.ts`
- `pnpm test -- tests/unit/profile/profile-runtime-paging.test.ts`
- `pnpm test -- tests/unit/timeline/timeline-runtime-route-discovery.test.ts`

The browser gate remains the required evidence before changing the audit rows
from `partial` to `implemented`.

## Related

- [../architecture/network/subscription-orchestration/feed-route-isolation.md](../architecture/network/subscription-orchestration/feed-route-isolation.md)
- [verification.md](verification.md)
