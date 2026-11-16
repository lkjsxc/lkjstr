// Read-only control requests use the actual source routes, including NIP-65 expansion.
import { auditControls, sourceRoutes, routeControls } from './real-hour-audit.mjs';
export async function comparePublic({ page, cdp, account, startedAt, endedAt, savedSeen, savedObservation }) {
  const routes = sourceRoutes(await cdp.queries(), account);
  const window = { since: Math.floor(startedAt / 1000), until: Math.floor(endedAt / 1000) };
  const home = await routeControls(routes.home,
    { kinds: [1], authors: [...new Set([...account.follows, account.pubkey])], ...window }, 6000);
  const notifications = await routeControls(routes.notifications,
    { kinds: [1], '#p': [account.pubkey], ...window }, 3000);
  return auditControls({ page, cdp, account, startedAt, endedAt, savedSeen, savedObservation, controls: { home, notifications } });
}
