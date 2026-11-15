import { afterEach, expect, it, vi } from 'vitest';
import type { ActResult, SubHandlers } from '../src/engine/client.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { dropViewState, loadViewState, saveViewState } from '../src/shared/view-state.ts';
import { mountChannels } from '../src/views/channels.ts';
import { mountCompose } from '../src/views/compose.ts';
import type { ViewEnv } from '../src/views/registry.ts';

function setup() {
  let handlers: SubHandlers;
  const act = vi.fn();
  const env = {
    instance: `channel-test-${crypto.randomUUID()}`,
    settings: createSettings(),
    visible: createSignal(true),
    engine: {
      me: () => 'author',
      accounts: createSignal({ active: 'author', accounts: [] }),
      act,
      open: (_: unknown, h: SubHandlers) => {
        handlers = h;
        return { window() {}, visible() {}, close() {} };
      },
    },
  } as unknown as ViewEnv;
  const el = document.createElement('div');
  return { env, el, act, handlers: () => handlers };
}
afterEach(() => {
  localStorage.clear();
  setLang('en');
});

it('keeps empty cached channel rows pending until discovery settles and exposes failures', () => {
  setLang('en');
  const x = setup();
  const off = mountChannels(x.el, x.env);
  const status = () => x.el.querySelector('.fstate')?.textContent;
  x.handlers().rows([], true, true);
  expect(status()).toBe('Asking relays…');
  x.handlers().state?.({ phase: 'failed', relaysAsked: 1, relaysAnswered: 0 });
  expect(status()).toBe('No relay could be reached.');
  x.handlers().rows([], true, true);
  expect(status()).toBe('No relay could be reached.');
  x.handlers().state?.({ phase: 'done', relaysAsked: 1, relaysAnswered: 1 });
  expect(status()).toBe('No channel found.');
  off();
});

it.each([undefined, 'room'])(
  'retains a complete failed draft (%s) while the next is typed and across remount',
  async (channel) => {
    const x = setup();
    setLang('en');
    const media = [{ url: 'https://example.test/image.png', type: 'image', mime: 'image/png' }];
    const emoji = [{ code: 'cat', url: 'https://example.test/cat.png' }];
    saveViewState(x.env.instance, { text: 'first :cat:', emoji });
    let finish!: (r: ActResult) => void;
    x.act.mockImplementation((action: { a: string }) =>
      action.a === 'upload'
        ? Promise.resolve({ ok: true, uploaded: media[0] })
        : new Promise<ActResult>((resolve) => {
            finish = resolve;
          }),
    );
    let off = mountCompose(x.el, x.env, channel);
    const file = new File(['image'], 'image.png', { type: 'image/png' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(0) });
    const input = x.el.querySelector('input')!;
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(x.el.querySelector('.thumb.done')).not.toBeNull());
    (x.el.querySelector('.primary') as HTMLButtonElement).click();
    const area = x.el.querySelector('textarea')!;
    expect(area.value).toBe('');
    area.value = 'next message';
    area.dispatchEvent(new Event('input'));
    finish({ t: 'result', req: 'test', ok: false, error: { code: 'rejected' } });
    await vi.waitFor(() => expect(x.el.textContent).toContain('Refused'));
    expect(area.value).toBe('next message');
    off();
    x.env.engine.me = () => 'other-account';
    off = mountCompose(x.el, x.env, channel);
    x.act.mockResolvedValue({ t: 'result', req: 'retry', ok: true });
    [...x.el.querySelectorAll('button')].find((b) => b.textContent === 'Retry')!.click();
    expect(x.act.mock.lastCall?.[0]).toMatchObject({
      a: 'publish',
      as: 'author',
      what: {
        draft: { text: 'first :cat:', ...(channel ? { channel } : {}), media, emoji },
      },
    });
    await vi.waitFor(() =>
      expect(loadViewState<{ drafts: unknown[] }>(`${x.env.instance}:outbox`).drafts).toEqual([]),
    );
    expect(x.el.querySelector('textarea')?.value).toBe('next message');
    off();
  },
);

it('bounds pending and failed channel drafts without discarding them to make room', async () => {
  setLang('en');
  const x = setup();
  const finishes: ((r: ActResult) => void)[] = [];
  x.act.mockImplementation(() => new Promise<ActResult>((done) => finishes.push(done)));
  const off = mountCompose(x.el, x.env, 'room');
  const area = x.el.querySelector('textarea')!;
  const post = x.el.querySelector('.primary') as HTMLButtonElement;
  for (let n = 0; n < 20; n++) {
    area.value = `message ${n}`;
    area.dispatchEvent(new Event('input'));
    post.click();
  }
  area.value = 'next message';
  area.dispatchEvent(new Event('input'));
  expect(post.disabled).toBe(true);
  finishes[5]!({ t: 'result', req: 'failed', ok: false, error: { code: 'rejected' } });
  await vi.waitFor(() => expect(x.el.textContent).toContain('Refused'));
  expect(post.disabled).toBe(true);
  expect(loadViewState<{ drafts: unknown[] }>(`${x.env.instance}:outbox`).drafts).toHaveLength(20);
  // Discard is a labeled action, distinct from an attachment's remove cross.
  const discard = [...x.el.querySelectorAll('button')].find(
    (b) => b.textContent === 'Remove' && !b.disabled,
  );
  expect(discard).toBeDefined();
  discard!.click();
  expect(post.disabled).toBe(false);
  expect(area.value).toBe('next message');
  expect(loadViewState<{ drafts: unknown[] }>(`${x.env.instance}:outbox`).drafts).toHaveLength(19);
  off();
});

it('settles a publication across remount without overwriting the next ordinary draft', async () => {
  setLang('en');
  const x = setup();
  let finish!: (r: ActResult) => void;
  x.act.mockImplementation(
    () =>
      new Promise<ActResult>((resolve) => {
        finish = resolve;
      }),
  );
  let off = mountCompose(x.el, x.env);
  const area = x.el.querySelector('textarea')!;
  area.value = 'first post';
  area.dispatchEvent(new Event('input'));
  (x.el.querySelector('.primary') as HTMLButtonElement).click();
  expect(area.value).toBe('');
  off();
  off = mountCompose(x.el, x.env);
  const next = x.el.querySelector('textarea')!;
  next.value = 'next draft';
  next.dispatchEvent(new Event('input'));
  expect(x.el.querySelector('.cdraft')?.textContent).toContain('Sending');
  finish({ t: 'result', req: 'done', ok: true });
  await vi.waitFor(() => expect(x.el.querySelector('.cdraft')).toBeNull());
  expect(loadViewState<{ text: string }>(x.env.instance).text).toBe('next draft');
  expect(next.value).toBe('next draft');
  expect(x.el.querySelector('[role="status"]')?.textContent).toContain('Delivered');
  off();
});

it.each([undefined, 'old-room'])(
  'isolates a fresh composer reusing an in-flight tab ID (%s), mounted or disposed',
  async (oldChannel) => {
    setLang('en');
    const x = setup();
    const finishes: ((r: ActResult) => void)[] = [];
    const deliveries: ((relays: unknown[]) => void)[] = [];
    x.act.mockImplementation(
      (_, handlers) =>
        new Promise<ActResult>((resolve) => {
          finishes.push(resolve);
          deliveries.push(handlers.delivery);
        }),
    );
    let off = mountCompose(x.el, x.env, oldChannel);
    const send = (text: string) => {
      const area = x.el.querySelector('textarea')!;
      area.value = text;
      area.dispatchEvent(new Event('input'));
      (x.el.querySelector('.primary') as HTMLButtonElement).click();
    };
    send('old message');
    const oldOwner = loadViewState<{ id: string }>(`${x.env.instance}:outbox`).id;
    off();
    // own.retire/fresh drops both the parent tab and its embedded composer's saved state.
    dropViewState(x.env.instance);
    off = mountCompose(x.el, x.env, oldChannel ? 'different-room' : undefined);
    expect(loadViewState<{ id: string }>(`${x.env.instance}:outbox`).id).not.toBe(oldOwner);
    expect(x.el.querySelector('.cdraft')).toBeNull();
    deliveries[0]!([{ url: 'wss://old.test', state: 'ok' }]);
    expect(x.el.querySelector('[role="status"]')?.textContent).toBe('');
    send('new message');
    if (oldChannel) off(); // Also protect the new saved outbox while it is unmounted.
    finishes[0]!({ t: 'result', req: 'old', ok: false, error: { code: 'rejected' } });
    await vi.waitFor(() => {
      const saved = loadViewState<{ drafts: { draft: { text: string } }[] }>(
        `${x.env.instance}:outbox`,
      );
      expect(saved.drafts?.map((item) => item.draft.text)).toEqual(['new message']);
    });
    if (!oldChannel) {
      expect(x.el.textContent).not.toContain('old message');
      expect(x.el.textContent).not.toContain('Refused');
      off();
    }
    off = mountCompose(x.el, x.env, oldChannel ? 'different-room' : undefined);
    expect(x.el.querySelector('.cdraft')?.textContent).toContain('Sending');
    finishes[1]!({ t: 'result', req: 'new', ok: true });
    await vi.waitFor(() => expect(x.el.querySelector('.cdraft')).toBeNull());
    off();
  },
);
