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
    active: {} as object | null,
    waiting: null,
    installing: null as (EventTarget & { state: ServiceWorkerState }) | null,
    update: vi.fn(async () => undefined),
  });
  const workers = Object.assign(new EventTarget(), {
    controller: controlled ? {} : null,
    ready: Promise.resolve(registration),
    register: vi.fn(async () => registration),
  });
  const readyObserved = vi.spyOn(workers.ready, 'then');
  const document = Object.assign(new EventTarget(), {
    visibilityState: 'visible',
    activeElement: null,
  });
  vi.stubGlobal('navigator', { serviceWorker: workers });
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('window', page);
  vi.stubGlobal('document', document);
  const ready = createSignal<object | null>(null);
  const { installShell } = await import('../src/engine/offline-shell.ts');
  installShell(
    () => false,
    () => {},
    ready,
  );
  return { ready, workers, page, registration, document, readyObserved };
}
const pageEvent = (name: string, persisted: boolean) =>
  Object.assign(new Event(name), { persisted });

describe('first shell installation', () => {
  it('waits for actual engine readiness once on an uncontrolled page', async () => {
    const f = await fixture();
    expect(f.workers.register).not.toHaveBeenCalled();
    f.ready.set({});
    await vi.advanceTimersByTimeAsync(0);
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
    f.page.dispatchEvent(pageEvent('pagehide', false));
    f.ready.set({});
    expect(f.workers.register).not.toHaveBeenCalled();
  });
  it('preserves deferred readiness across a retained history page', async () => {
    const f = await fixture();
    f.page.dispatchEvent(pageEvent('pagehide', true));
    f.ready.set({});
    expect(f.workers.register).not.toHaveBeenCalled();
    f.page.dispatchEvent(pageEvent('pageshow', true));
    expect(f.workers.register).toHaveBeenCalledTimes(1);
  });
  it('waits for visibility before starting the first installation', async () => {
    const f = await fixture();
    f.document.visibilityState = 'hidden';
    f.ready.set({});
    f.page.dispatchEvent(new Event('online'));
    expect(f.workers.register).not.toHaveBeenCalled();
    f.document.visibilityState = 'visible';
    f.document.dispatchEvent(new Event('visibilitychange'));
    expect(f.workers.register).toHaveBeenCalledTimes(1);
  });
});

describe('shell registration recovery', () => {
  it('recovers a failed first registration promptly on an online event', async () => {
    const f = await fixture();
    f.workers.register.mockRejectedValueOnce(new Error('offline'));
    f.ready.set({});
    await vi.advanceTimersByTimeAsync(0);
    expect(f.workers.register).toHaveBeenCalledTimes(1);
    f.page.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.workers.register).toHaveBeenCalledTimes(2);
    expect(f.registration.update).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(f.workers.register).toHaveBeenCalledTimes(2);
  });
  it('uses exponential retries capped at thirty seconds', async () => {
    const f = await fixture();
    f.workers.register.mockRejectedValue(new Error('offline'));
    f.ready.set({});
    await vi.advanceTimersByTimeAsync(0);
    let attempts = 1;
    for (const wait of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
      await vi.advanceTimersByTimeAsync(wait - 1);
      expect(f.workers.register).toHaveBeenCalledTimes(attempts);
      await vi.advanceTimersByTimeAsync(1);
      expect(f.workers.register).toHaveBeenCalledTimes(++attempts);
      expect(vi.getTimerCount()).toBe(2); // One periodic check and one retry.
      expect(f.readyObserved).toHaveBeenCalledTimes(1);
    }
  });
  it('never overlaps a pending registration despite repeated lifecycle events', async () => {
    const f = await fixture();
    let finish!: (value: typeof f.registration) => void;
    f.workers.register.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    f.ready.set({});
    for (let i = 0; i < 10; i++) {
      f.page.dispatchEvent(new Event('focus'));
      f.page.dispatchEvent(new Event('online'));
    }
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.workers.register).toHaveBeenCalledTimes(1);
    finish(f.registration);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.registration.update).not.toHaveBeenCalled();
  });
  it('retries an install that becomes redundant after register has resolved', async () => {
    const f = await fixture();
    const installing = Object.assign(new EventTarget(), {
      state: 'installing' as ServiceWorkerState,
    });
    f.registration.active = null;
    f.registration.installing = installing;
    f.ready.set({});
    await vi.advanceTimersByTimeAsync(0);
    expect(f.workers.register).toHaveBeenCalledTimes(1);
    installing.state = 'redundant';
    f.registration.installing = null;
    installing.dispatchEvent(new Event('statechange'));
    f.registration.active = {};
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.workers.register).toHaveBeenCalledTimes(2);
    installing.dispatchEvent(new Event('statechange'));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(f.workers.register).toHaveBeenCalledTimes(2);
  });
  it('releases retries and listeners permanently on a normal departure', async () => {
    const f = await fixture();
    f.workers.register.mockRejectedValue(new Error('offline'));
    f.ready.set({});
    await vi.advanceTimersByTimeAsync(0);
    f.page.dispatchEvent(pageEvent('pagehide', false));
    for (const type of ['focus', 'online', 'pageshow']) f.page.dispatchEvent(new Event(type));
    f.document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(300_000);
    expect(f.workers.register).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('ignores a registration failure arriving after permanent departure', async () => {
    const f = await fixture();
    let fail!: (error: Error) => void;
    f.workers.register.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    f.ready.set({});
    f.page.dispatchEvent(pageEvent('pagehide', false));
    fail(new Error('late failure'));
    await vi.advanceTimersByTimeAsync(300_000);
    expect(f.workers.register).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('pauses retries in retained history and resumes promptly on pageshow', async () => {
    const f = await fixture();
    f.workers.register.mockRejectedValueOnce(new Error('offline'));
    f.ready.set({});
    await vi.advanceTimersByTimeAsync(0);
    f.page.dispatchEvent(pageEvent('pagehide', true));
    f.page.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.workers.register).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    f.page.dispatchEvent(pageEvent('pageshow', true));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.workers.register).toHaveBeenCalledTimes(2);
  });
  it.each([false, true])(
    'counts successful register as the freshness check (controlled=%s)',
    async (controlled) => {
      const f = await fixture(controlled);
      f.ready.set({});
      await vi.advanceTimersByTimeAsync(0);
      expect(f.workers.register).toHaveBeenCalledTimes(1);
      expect(f.registration.update).not.toHaveBeenCalled();
      f.page.dispatchEvent(new Event('focus'));
      expect(f.registration.update).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(60_001);
      f.page.dispatchEvent(new Event('focus'));
      expect(f.registration.update).toHaveBeenCalledTimes(1);
    },
  );

  it('ignores a successful registration arriving after permanent departure', async () => {
    const f = await fixture();
    let finish!: (value: typeof f.registration) => void;
    f.workers.register.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const listen = vi.spyOn(f.registration, 'addEventListener');
    f.ready.set({});
    f.page.dispatchEvent(pageEvent('pagehide', false));
    finish(f.registration);
    await vi.advanceTimersByTimeAsync(0);
    expect(listen).not.toHaveBeenCalled();
    expect(f.registration.update).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('detaches installer and registration listeners on failure and departure', async () => {
    const f = await fixture();
    const installing = Object.assign(new EventTarget(), {
      state: 'installing' as ServiceWorkerState,
    });
    const added = vi.spyOn(installing, 'addEventListener');
    const removed = vi.spyOn(installing, 'removeEventListener');
    const addedRegistration = vi.spyOn(f.registration, 'addEventListener');
    const removedRegistration = vi.spyOn(f.registration, 'removeEventListener');
    f.registration.active = null;
    f.registration.installing = installing;
    f.ready.set({});
    await vi.advanceTimersByTimeAsync(0);
    const stateListener = added.mock.calls.find(([type]) => type === 'statechange')?.[1];
    const updateListener = addedRegistration.mock.calls.find(
      ([type]) => type === 'updatefound',
    )?.[1];
    installing.state = 'redundant';
    f.registration.installing = null;
    installing.dispatchEvent(new Event('statechange'));
    expect(removed).toHaveBeenCalledWith('statechange', stateListener);
    expect(removedRegistration).toHaveBeenCalledWith('updatefound', updateListener);
    f.registration.active = {};
    await vi.advanceTimersByTimeAsync(1000);
    const current = addedRegistration.mock.calls
      .filter(([type]) => type === 'updatefound')
      .at(-1)?.[1];
    f.page.dispatchEvent(pageEvent('pagehide', false));
    expect(removedRegistration).toHaveBeenCalledWith('updatefound', current);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries once when a queued updatefound observes no remaining worker slots', async () => {
    const f = await fixture();
    const installing = Object.assign(new EventTarget(), {
      state: 'installing' as ServiceWorkerState,
    });
    f.registration.active = null;
    f.registration.installing = installing;
    const removed = vi.spyOn(installing, 'removeEventListener');
    const removedRegistration = vi.spyOn(f.registration, 'removeEventListener');
    f.ready.set({});
    await vi.advanceTimersByTimeAsync(0);
    f.registration.installing = null;
    f.registration.dispatchEvent(new Event('updatefound'));
    expect(removed).toHaveBeenCalledWith('statechange', expect.any(Function));
    expect(removedRegistration).toHaveBeenCalledWith('updatefound', expect.any(Function));
    expect(vi.getTimerCount()).toBe(2);
    f.registration.dispatchEvent(new Event('updatefound'));
    await vi.advanceTimersByTimeAsync(999);
    expect(f.workers.register).toHaveBeenCalledTimes(1);
    f.registration.active = {};
    await vi.advanceTimersByTimeAsync(1);
    expect(f.workers.register).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(f.workers.register).toHaveBeenCalledTimes(2);
  });
});
