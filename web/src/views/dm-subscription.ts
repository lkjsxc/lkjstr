// Initial visibility is atomic on newer engines; older ones are opened only when actually shown.
import type { DmQuery, DmSnapshot } from '../engine/protocol.ts';
import { dmVisible } from './dm-surface.ts';
import type { ViewEnv } from './registry.ts';
export function dmSubscription(env: ViewEnv, query: DmQuery, receive: (value: DmSnapshot) => void) {
  let sub: ReturnType<NonNullable<typeof env.engine.dm>['open']> | undefined;
  let closed = false;
  const show = (): void => {
    if (closed) return;
    const visible = dmVisible(env);
    if (!sub && (visible || (env.engine.info.get()?.version ?? 0) >= 7))
      sub = env.engine.dm?.open(query, receive, { visible });
    sub?.visible(visible);
  };
  const off = env.visible.subscribe(show);
  document.addEventListener('visibilitychange', show);
  show();
  return {
    more: () => sub?.more(),
    close(): void {
      closed = true;
      off();
      document.removeEventListener('visibilitychange', show);
      sub?.close();
      sub = undefined;
    },
  };
}
