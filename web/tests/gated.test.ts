// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { setLang } from '../src/shared/i18n.ts';
import { createSignal } from '../src/shared/signal.ts';
import { gated } from '../src/views/gated.ts';
import { offered, setServed, VIEWS, type ViewEnv } from '../src/views/registry.ts';

const envWith = (version: number | undefined) => {
  const info = createSignal<{ engine: string; version: number } | null>(
    version === undefined ? null : { engine: 'test', version },
  );
  return { info, env: { engine: { info } } as unknown as ViewEnv };
};

describe('views a newer engine serves', () => {
  it('are offered only once the engine has said it speaks their protocol', () => {
    const channels = VIEWS.find((v) => v.id === 'channels');
    if (!channels) throw new Error('no channels view');
    setServed(0);
    expect(offered(channels)).toBe(false);
    setServed(3);
    expect(offered(channels)).toBe(false);
    expect(VIEWS.filter(offered).some((v) => v.id === 'home')).toBe(true);
    setServed(4);
    expect(offered(channels)).toBe(true);
  });

  it('wait for the engine, mount for a new one, and say so for an old one', () => {
    setLang('en');
    let mounted = 0;
    let disposed = 0;
    const mount = gated(4, 'channel.unsupported', () => (mounted++, () => void disposed++));
    const late = envWith(undefined);
    const el = document.createElement('div');
    const off = mount(el, late.env);
    expect([mounted, el.textContent]).toEqual([0, '']);
    late.info.set({ engine: 'test', version: 4 });
    late.info.set({ engine: 'test', version: 4 });
    expect(mounted).toBe(1);
    off();
    expect(disposed).toBe(1);
    const old = envWith(3);
    const el2 = document.createElement('div');
    mount(el2, old.env)();
    expect([mounted, el2.textContent]).toEqual([1, 'This engine does not serve channels.']);
  });
});
