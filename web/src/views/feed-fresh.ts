// One new-row pill for every feed, including notifications: it counts what arrived above a held reading
// position and is never needed at the top, where rows flow in. Its containing pin is inside the tile's list.
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
  let pending = 0;
  let overflow = false;
  const show = (count: number, more = false): void => {
    if (count === pending && more === overflow) return;
    pending = count;
    overflow = more;
    el.hidden = count === 0 && !more;
    el.replaceChildren(icon('up'), t(more ? 'feed.freshOverflow' : 'feed.fresh', { n: count }));
    if (more) {
      el.title = t('feed.freshOverflowHint');
      el.setAttribute('aria-label', el.title);
    } else {
      el.removeAttribute('title');
      el.removeAttribute('aria-label');
    }
  };
  const read = (rows: readonly Row[]): void => {
    latest = rows;
    if (scroller.scrollTop >= 8 || !env.visible.get()) return;
    el.hidden = pending === 0 && !overflow;
    // Rows that flowed in behind a hidden page were drawn, not read.
    if (document.visibilityState === 'hidden') return;
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
  const reread = (): void => read(latest);
  const off = env.visible.subscribe(reread);
  document.addEventListener('visibilitychange', reread);
  return {
    el,
    overflow: () => overflow,
    show,
    read,
    dispose() {
      disposed = true;
      off();
      document.removeEventListener('visibilitychange', reread);
    },
  };
}
