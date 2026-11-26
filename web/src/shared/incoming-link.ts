import type { Engine } from '../engine/client.ts';
import { t } from './i18n.ts';
import { type NostrLink, nostrLinkPath } from './nostr-link.ts';

function incomingNostrLink(path: string): NostrLink | undefined {
  // Prefixed links preserve the original raw identifier for Worker validation.
  const [, route, ref] = /^\/(n|p|a)\/([a-zA-Z0-9]{1,5000})\/?$/.exec(path) ?? [];
  if (ref && (route === 'n' || route === 'p' || route === 'a')) return { route, ref };
  return nostrLinkPath(path);
}

export async function checkNostrLink(
  engine: Pick<Engine, 'act'>,
  link: NostrLink,
  report: (text: string) => void,
): Promise<boolean> {
  const result = await engine.act({ a: 'link.check', ...link });
  if (!result.ok) report(t(result.error?.code === 'rejected' ? 'link.invalid' : 'error.internal'));
  return result.ok;
}

export async function openIncomingLink(
  engine: Pick<Engine, 'act' | 'accountState'>,
  open: (kind: 'profile' | 'thread', ref: string) => void,
  report: (text: string) => void,
): Promise<void> {
  const path = location.pathname;
  if (path !== '/') {
    const link = incomingNostrLink(path);
    if (!link) report(t('link.invalid'));
    else if (await checkNostrLink(engine, link, report)) {
      const account = engine.accountState;
      if (account?.get().phase === 'loading') {
        await new Promise<void>((resolve) => {
          const unsubscribe = account.subscribe(({ phase }) => {
            if (phase === 'loading') return;
            unsubscribe();
            resolve();
          });
        });
      }
      open(link.route === 'p' ? 'profile' : 'thread', link.ref);
    }
  }
  if (path !== '/' || location.search || location.hash) history.replaceState(null, '', '/');
}
