// A Relay tab: one relay on its own, apart from the reader's relays (docs/design.md, Relays). Its list is a feed of the
// notes that relay served, headed by what it says about itself (`relay-head.ts`).
import { t } from '../shared/i18n.ts';
import { loadViewState } from '../shared/view-state.ts';
import { mountFeed } from './feed.ts';
import { copy } from './parts.ts';
import type { ViewEnv } from './registry.ts';

/** A feed of the relay's own notes, with the relay's address and the list one press away. */
export function mountRelay(el: HTMLElement, env: ViewEnv): () => void {
  const url = loadViewState<{ relay?: string }>(env.instance).relay;
  env.menu(() => [
    ...(url ? [{ label: t('relay.head.copy'), run: () => void copy(env, url) }] : []),
    { label: t('relays.edit'), run: () => env.open('settings', { at: 'set.relayList' }) },
    { label: t('view.relays'), run: () => env.open('relays') },
  ]);
  return mountFeed(el, env, 'relay');
}
