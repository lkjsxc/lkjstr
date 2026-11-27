import { afterEach, expect, it, vi } from 'vitest';
import type { ActResult, ActWatch } from '../src/engine/client.ts';
import type { Action, Failure } from '../src/engine/protocol.ts';
import { setLang } from '../src/shared/i18n.ts';
import { SERVER_CHOICES } from '../src/shared/media-servers.ts';
import { createSignal } from '../src/shared/signal.ts';
import { createAttachments } from '../src/views/compose-media.ts';
import type { ViewEnv } from '../src/views/registry.ts';

afterEach(() => setLang('en'));

function setup() {
  setLang('en');
  const act = vi.fn<(action: Action, watch?: ActWatch) => Promise<ActResult>>();
  const env = {
    visible: createSignal(true),
    engine: {
      me: () => 'author',
      accounts: createSignal({ accounts: [] }),
      act,
      open: () => ({ window() {}, visible() {}, close() {} }),
    },
  } as unknown as ViewEnv;
  const attachments = createAttachments(env, () => {});
  const file = new File(['image'], 'image.png', { type: 'image/png' });
  const read = vi.fn(async () => new ArrayBuffer(5));
  Object.defineProperty(file, 'arrayBuffer', { value: read });
  const failure = (message?: string, code: Failure['code'] = 'too-large'): ActResult => ({
    t: 'result',
    req: 'upload',
    ok: false,
    error: { code, message },
  });
  act.mockResolvedValue(failure(SERVER_CHOICES[0], 'upload-network'));
  const failed = async () => {
    await vi.waitFor(() => expect(attachments.el.querySelector('.thumb.failed')).not.toBeNull());
    return attachments.el.querySelector('select')!;
  };
  const retry = () => (attachments.el.querySelector('.btn') as HTMLButtonElement).click();
  return { attachments, file, read, act, failure, failed, retry };
}

it.each([
  ['too-large', 'too-large'],
  ['signer-missing', 'signer-missing'],
  ['not-found', undefined],
  ['upload-network', 'https://'],
] as const)(
  'keeps the chosen retry destination after %s without a server URL',
  async (code, message) => {
    const x = setup();
    try {
      x.attachments.add([x.file]);
      const pick = await x.failed();
      const chosen = SERVER_CHOICES[1]!;
      pick.value = chosen;
      x.act.mockResolvedValue(x.failure(message, code));
      x.retry();
      expect((await x.failed()).value).toBe(chosen);
      x.retry();
      await x.failed();
      expect(x.act.mock.lastCall?.[0]).toMatchObject({ a: 'upload', server: chosen });
      expect(x.read).toHaveBeenCalledTimes(3);
      expect(x.attachments.status()).toBe('failed');
    } finally {
      x.attachments.dispose();
    }
  },
);

it.each(['result', 'progress'])(
  'keeps a destination reported by %s available for retry',
  async (via) => {
    const x = setup();
    const chosen = 'https://custom.example/blossom';
    x.act.mockImplementation(async (_, watch) => {
      if (via === 'progress')
        watch?.progress?.(0, 5, {
          t: 'progress',
          req: 'upload',
          sent: 0,
          total: 5,
          server: chosen,
          phase: 'signing',
        });
      return x.failure(via === 'result' ? chosen : 'signer-missing', 'signer-missing');
    });
    try {
      x.attachments.add([x.file]);
      expect((await x.failed()).value).toBe(chosen);
      expect(x.attachments.el.textContent).toContain('custom.example/blossom');
      x.retry();
      await x.failed();
      expect(x.act.mock.lastCall?.[0]).toMatchObject({ a: 'upload', server: chosen });
    } finally {
      x.attachments.dispose();
    }
  },
);

it.each(['remove', 'clear', 'dispose'] as const)(
  '%s aborts the upload behind an existing attachment control',
  async (operation) => {
    const x = setup();
    let finish: (result: ActResult) => void = () => {};
    x.act.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    try {
      x.attachments.add([x.file]);
      await vi.waitFor(() => expect(x.act).toHaveBeenCalledTimes(1));
      const signal = x.act.mock.lastCall?.[1]?.uploadSignal;
      expect(signal?.aborted).toBe(false);
      if (operation === 'remove')
        (x.attachments.el.querySelector('.x') as HTMLButtonElement).click();
      else x.attachments[operation]();
      expect(signal?.aborted).toBe(true);
      finish({ t: 'result', req: 'upload', ok: false, cancelled: true });
      await Promise.resolve();
      expect(x.attachments.el.querySelector('.failed')).toBeNull();
    } finally {
      x.attachments.dispose();
    }
  },
);
it('a late File read cannot start an attachment removed before transfer', async () => {
  const x = setup();
  let finish: (buffer: ArrayBuffer) => void = () => {};
  x.read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  try {
    x.attachments.add([x.file]);
    (x.attachments.el.querySelector('.x') as HTMLButtonElement).click();
    finish(new ArrayBuffer(4));
    await Promise.resolve();
    await Promise.resolve();
    expect(x.act).not.toHaveBeenCalled();
    expect(x.attachments.count()).toBe(0);
  } finally {
    x.attachments.dispose();
  }
});

it('opens a draft picture full size in a media tab, while it uploads and once it is up', async () => {
  const x = setup();
  const open = vi.fn();
  const made = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local/1');
  const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  let done: (r: ActResult) => void = () => {};
  x.act.mockImplementation(() => new Promise<ActResult>((resolve) => (done = resolve)));
  const viewEnv = {
    visible: createSignal(true),
    open,
    engine: {
      me: () => 'author',
      accounts: createSignal({ accounts: [] }),
      act: x.act,
      open: () => ({ window() {}, visible() {}, close() {} }),
    },
  } as unknown as ViewEnv;
  const a = createAttachments(viewEnv, () => {});
  try {
    a.add([x.file]);
    const pending = a.el.querySelector<HTMLAnchorElement>('.tpic');
    expect(pending?.querySelector('img')?.getAttribute('src')).toBe('blob:local/1');
    pending?.click();
    expect(open).toHaveBeenLastCalledWith(
      'media',
      { media: [{ type: 'image', url: 'blob:local/1' }], index: 0 },
      expect.objectContaining({ split: false }),
    );
    await vi.waitFor(() => expect(x.act).toHaveBeenCalled());
    done({
      t: 'result',
      req: 'upload',
      ok: true,
      uploaded: { url: 'https://media.example/a.png', type: 'image', mime: 'image/png' },
    } as ActResult);
    await vi.waitFor(() => expect(a.el.querySelector('.thumb.done')).not.toBeNull());
    a.el.querySelector<HTMLAnchorElement>('.tpic')?.click();
    expect(open).toHaveBeenLastCalledWith(
      'media',
      { media: [{ type: 'image', url: 'https://media.example/a.png' }], index: 0 },
      expect.anything(),
    );
    a.clear();
    expect(revoked).toHaveBeenCalledWith('blob:local/1');
  } finally {
    made.mockRestore();
    revoked.mockRestore();
    a.dispose();
  }
});
