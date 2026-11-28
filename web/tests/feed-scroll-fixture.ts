import { createEngine } from '../src/engine/client.ts';
import type { FromEngine, NotificationRow, ToEngine } from '../src/engine/protocol.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { mountFeed } from '../src/views/feed.ts';

const author = { pubkey: 'a'.repeat(64), npub: 'npub1fixture', name: 'Alice' };
const row = (n: number): NotificationRow => ({
  kind: 'notification',
  key: `notification:${n}`,
  type: 'reaction',
  at: n * 1000,
  actors: [author],
  others: 0,
  unread: n === 21,
});

export function notificationFeed() {
  const sent: ToEngine[] = [];
  let receive!: (message: FromEngine) => void;
  const engine = createEngine({
    post: (message) => void sent.push(message),
    listen: (handler) => {
      receive = handler;
    },
    close() {},
  });
  receive({ t: 'ready', version: 13, engine: 'fixture' });
  receive({
    t: 'accounts',
    accounts: [{ author, signer: 'local', unread: 0 }],
    active: author.pubkey,
  });
  const settings = createSettings();
  setLang('en');
  const el = document.createElement('div');
  const layer = document.createElement('div');
  document.body.append(el, layer);
  const dispose = mountFeed(
    el,
    {
      engine,
      settings,
      layer,
      visible: createSignal(true),
      instance: 'notification-scroll-fixture',
      open() {},
      close() {},
      menu() {},
      resetLayouts() {},
      setTitle() {},
    },
    'notifications',
  );
  const opened = sent.find((message) => message.t === 'open');
  if (opened?.t !== 'open') throw new Error('missing notification subscription');
  const sub = opened.sub;
  const list = el.querySelector<HTMLElement>('.list')!;
  return {
    el,
    list,
    last: () => sent.findLast((message) => message.t === 'window'),
    rows: (n: number, unread = true) =>
      receive({
        t: 'rows',
        sub,
        rows: Array.from({ length: n }, (_, i) => ({
          ...row(n - i),
          unread: unread && n - i === 21,
        })),
        atTop: true,
        atBottom: true,
      }),
    shift: () => Number.parseFloat(el.style.getPropertyValue('--feed-shift') || '0'),
    pill: () => el.querySelector<HTMLButtonElement>('.fresh')!,
    dispose() {
      dispose();
      engine.dispose();
      settings.dispose();
      el.remove();
      layer.remove();
    },
  };
}
