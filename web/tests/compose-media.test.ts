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
      expect(x.attachments.blocked()).toBe(true);
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
