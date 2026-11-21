import type { Engine } from '../engine/client.ts';
import { t } from './i18n.ts';

export async function openIncomingLink(
  engine: Engine,
  open: (kind: 'profile' | 'thread', ref: string) => void,
  report: (text: string) => void,
): Promise<void> {
  const path = location.pathname;
  if (path !== '/') {
    const match = /^\/(n|p|a)\/([a-zA-Z0-9]{1,5000})\/?$/.exec(path);
    const route = match?.[1];
    const ref = match?.[2];
    if ((route === 'n' || route === 'p' || route === 'a') && ref) {
      const result = await engine.act({ a: 'link.check', route, ref });
      if (result.ok) open(route === 'p' ? 'profile' : 'thread', ref);
      else report(t(result.error?.code === 'rejected' ? 'link.invalid' : 'error.internal'));
    } else report(t('link.invalid'));
  }
  if (path !== '/' || location.search || location.hash) history.replaceState(null, '', '/');
}
