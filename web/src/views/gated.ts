// A view only a newer engine can serve. Until the engine has said which protocol it speaks nothing is drawn; an
// engine that is too old gets one line saying so instead of a view that would wait for ever (a tab saved in a
// layout can meet an older engine). Such views are not offered at all then (`registry.ts`: `offered`).
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import type { Disposer } from '../shared/signal.ts';
import type { ViewDef } from './registry.ts';

export const gated =
  (since: number, absent: Key, mount: ViewDef['mount']): ViewDef['mount'] =>
  (el, env) => {
    let dispose: Disposer | undefined;
    const look = (): void => {
      const version = env.engine.info.get()?.version;
      if (version === undefined || dispose) return;
      if (version >= since) dispose = mount(el, env);
      else el.replaceChildren(h('div', { class: 'fstate muted' }, t(absent)));
    };
    const off = env.engine.info.subscribe(look);
    look();
    return () => {
      off();
      dispose?.();
    };
  };
