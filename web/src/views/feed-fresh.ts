// One new-row pill for every feed, including notifications. Its containing pin is inside the tile's list.
import type { NotificationRow, Row } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import type { ViewEnv } from './registry.ts';
export function createFresh(scroller: HTMLElement, env: ViewEnv, kind: string, top: () => void) {
  const el = h('button', { class: 'fresh', hidden: true, onclick: top });
  let seen = '';
  let marking = false;
  let disposed = false;
  let latest: readonly Row[] = [];
  const show = (count: number): void => {
    el.hidden = count === 0 || scroller.scrollTop < 8;
    el.replaceChildren(icon('up'), t('feed.fresh', { n: count }));
  };
  const read = (rows: readonly Row[]): void => {
    latest = rows;
    if (scroller.scrollTop >= 8 || !env.visible.get()) return;
    el.hidden = true;
    if (kind !== 'notifications' || !env.engine.me() || marking || disposed) return;
    const unread = rows.filter((r): r is NotificationRow => r.kind === 'notification' && r.unread);
    const signature = unread
      .map((r) => `${r.key}:${r.at}:${r.actors.map((a) => a.pubkey).join(',')}:${r.others}`)
      .join('|');
    if (!signature) {
      seen = '';
      return;
    }
    const next = `${env.engine.me()}:${signature}`;
    if (next === seen) return;
    seen = next;
    marking = true;
    void env.engine.act({ a: 'seen', as: env.engine.me() }).then(() => {
      marking = false;
      read(latest);
    });
  };
  const off = env.visible.subscribe(() => read(latest));
  return {
    el,
    show,
    read,
    dispose() {
      disposed = true;
      off();
    },
  };
}
