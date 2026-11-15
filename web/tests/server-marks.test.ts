import { afterEach, expect, it, vi } from 'vitest';
import type { Row, ServerRow } from '../src/engine/protocol.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSignal } from '../src/shared/signal.ts';
import type { ViewEnv } from '../src/views/registry.ts';
import { listEntries } from '../src/views/settings-lists.ts';

afterEach(() => {
  document.body.replaceChildren();
  setLang('en');
});
it('draws old false and checking as muted, required failure with retry, and success everywhere', () => {
  setLang('en');
  const act = vi.fn(async () => ({ ok: true }));
  let draw: (rows: readonly Row[]) => void = () => {};
  const env = {
    visible: createSignal(true),
    engine: {
      me: () => 'account',
      accounts: createSignal({ accounts: [] }),
      act,
      open: (q: { source: string }, handlers: { rows: typeof draw }) => {
        if (q.source === 'media-servers') draw = handlers.rows;
        return { window() {}, visible() {}, close() {} };
      },
    },
  } as unknown as ViewEnv;
  const mounted = listEntries(env);
  const el = mounted.entries.find((e) => e.node.dataset.entry === 'set.servers')!.node;
  document.body.append(el);
  const row: ServerRow = {
    kind: 'server',
    key: 'https://media.test',
    url: 'https://media.test',
    protocol: 'blossom',
    ok: false,
  };
  try {
    draw([row]);
    expect(el.querySelector('.bad')).toBeNull();
    expect(el.querySelector('[data-state=unknown]')?.className).toBe('muted');
    draw([{ ...row, checked: true, error: { code: 'upload-network' } }]);
    expect(el.querySelector('.bad')?.textContent).toBe('Not answering');
    expect(el.querySelector('.bad')?.getAttribute('title')).toContain('could not be reached');
    (el.querySelector('[data-f=retry]') as HTMLButtonElement).click();
    expect(act).toHaveBeenCalledWith({ a: 'servers.check', server: row.url });
    draw([{ ...row, checked: false }]);
    expect(el.querySelector('.bad')).toBeNull();
    draw([{ ...row, checked: true, ok: true }]);
    expect(el.querySelector('[data-state=answering]')?.textContent).toBe('Blossom');
    expect(el.querySelector('[data-f=retry]')).toBeNull();
  } finally {
    mounted.dispose();
  }
});
