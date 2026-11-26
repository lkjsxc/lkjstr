import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSignal } from '../src/shared/signal.ts';

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function fixture(controlled = false) {
  vi.useFakeTimers();
  vi.resetModules();
  const page = new EventTarget();
  const registration = Object.assign(new EventTarget(), {
    active: {},
    waiting: null,
    installing: null,
    update: vi.fn(async () => undefined),
  });
  const workers = Object.assign(new EventTarget(), {
    controller: controlled ? {} : null,
    ready: Promise.resolve(registration),
    register: vi.fn(async () => registration),
  });
  vi.stubGlobal('navigator', { serviceWorker: workers });
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('window', page);
  vi.stubGlobal(
    'document',
    Object.assign(new EventTarget(), { visibilityState: 'visible', activeElement: null }),
  );
  const ready = createSignal<object | null>(null);
  const { installShell } = await import('../src/engine/offline-shell.ts');
  installShell(
    () => false,
    () => {},
    ready,
  );
  return { ready, workers, page };
}
describe('first shell installation', () => {
  it('waits for actual engine readiness once on an uncontrolled page', async () => {
    const f = await fixture();
    expect(f.workers.register).not.toHaveBeenCalled();
    f.ready.set({});
    await Promise.resolve();
    expect(f.workers.register).toHaveBeenCalledTimes(1);
    f.ready.set({});
    expect(f.workers.register).toHaveBeenCalledTimes(1);
  });
  it('keeps existing controlled clients checking for repair updates during boot', async () => {
    const f = await fixture(true);
    expect(f.workers.register).toHaveBeenCalledTimes(1);
  });
  it('releases a pending registration after permanent page departure', async () => {
    const f = await fixture();
    f.page.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: false }));
    f.ready.set({});
    expect(f.workers.register).not.toHaveBeenCalled();
  });
  it('preserves a pending registration across a retained history page', async () => {
    const f = await fixture();
    f.page.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: true }));
    f.ready.set({});
    expect(f.workers.register).toHaveBeenCalledTimes(1);
  });
});
