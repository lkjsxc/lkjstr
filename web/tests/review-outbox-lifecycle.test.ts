import { afterEach, expect, it, vi } from 'vitest';
import type { ActResult } from '../src/engine/client.ts';
import type { Draft } from '../src/engine/protocol.ts';
import { dropViewState, loadViewState, saveViewState } from '../src/shared/view-state.ts';
import { createChannelOutbox } from '../src/views/compose-outbox.ts';
import { createOwnViews } from '../src/wm/own-views.ts';
import { person, setup } from './wishes-support.ts';

afterEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});

for (const channel of [false, true])
  it(`clears a fresh ${channel ? 'channel' : 'Post'} outbox and restores it only with its closed tab`, async () => {
    const x = setup();
    const own = createOwnViews(x.env, x.env.instance, vi.fn(), vi.fn(), () => vi.fn(), vi.fn());
    const kind = channel ? 'channel' : 'compose';
    const tab = own.fresh(kind, new Set());
    const instance = `${x.env.instance}:${tab}`;
    const composer = instance + (channel ? ':say' : '');
    const env = { ...x.env, instance: composer };
    const box = createChannelOutbox(
      env,
      [],
      () => {},
      () => {},
      () => false,
    );
    const draft: Draft = {
      text: 'closed failure',
      channel: channel ? 'original-room' : undefined,
      media: [{ url: 'https://example.test/image.png', type: 'image', mime: 'image/png' }],
    };
    box.retain(draft);
    saveViewState(composer, { text: 'unfinished input' });
    box.dispose();
    const closed = own.retire(tab);
    expect(own.fresh(kind, new Set())).toBe(tab);
    expect(loadViewState(composer)).toEqual({});
    expect(loadViewState(`${composer}:outbox`)).toEqual({});
    const blank = createChannelOutbox(
      env,
      [],
      () => {},
      () => {},
      () => false,
    );
    blank.draw();
    expect(blank.el.textContent).toBe('');
    blank.dispose();
    own.fresh(kind, new Set(), JSON.parse(JSON.stringify(closed)));
    expect(loadViewState(composer)).toMatchObject({ text: 'unfinished input' });
    x.engine.me = () => 'another-account';
    const restored = createChannelOutbox(
      env,
      [],
      () => {},
      () => {},
      () => false,
    );
    restored.draw();
    [...restored.el.querySelectorAll('button')].find((b) => b.textContent === 'Retry')!.click();
    expect(x.act).toHaveBeenCalledWith(
      { a: 'publish', as: person.pubkey, what: { k: 'note', draft } },
      expect.anything(),
    );
    await Promise.resolve();
    restored.dispose();
    own.dispose();
  });

for (const ok of [false, true])
  it(`does not let an old ${ok ? 'successful' : 'failed'} send recreate or overwrite a reused tab's outbox`, async () => {
    const x = setup();
    let finish!: (r: ActResult) => void;
    x.act.mockImplementation(
      () =>
        new Promise<ActResult>((done) => {
          finish = done;
        }),
    );
    const old = createChannelOutbox(
      x.env,
      [],
      () => {},
      () => {},
      () => false,
    );
    old.publish({ text: 'old pending' });
    old.dispose();
    dropViewState(x.env.instance);
    const next = createChannelOutbox(
      x.env,
      [],
      () => {},
      () => {},
      () => false,
    );
    next.retain({ text: 'new draft' });
    finish({ t: 'result', req: 'old', ok, error: { code: 'rejected' } });
    await Promise.resolve();
    next.draw();
    expect(next.el.textContent).toContain('new draft');
    expect(next.el.textContent).not.toContain('old pending');
    expect(loadViewState(`${x.env.instance}:outbox`)).toMatchObject({
      drafts: [{ draft: { text: 'new draft' } }],
    });
    next.dispose();
  });

it('does not recreate a dropped outbox when a send finishes with no replacement tab', async () => {
  const x = setup();
  let finish!: (r: ActResult) => void;
  x.act.mockImplementation(
    () =>
      new Promise<ActResult>((done) => {
        finish = done;
      }),
  );
  const box = createChannelOutbox(
    x.env,
    [],
    () => {},
    () => {},
    () => false,
  );
  box.publish({ text: 'pending' });
  box.dispose();
  dropViewState(x.env.instance);
  finish({ t: 'result', req: 'old', ok: false, error: { code: 'rejected' } });
  await Promise.resolve();
  expect(loadViewState(`${x.env.instance}:outbox`)).toEqual({});
});
