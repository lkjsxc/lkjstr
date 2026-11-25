// The fake engine and rows the profile editor tests share.
import { vi } from 'vitest';
import type { ActResult, ActWatch, SubHandlers } from '../src/engine/client.ts';
import type { Account, Action, Author, ProfileRow } from '../src/engine/protocol.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import type { ViewEnv } from '../src/views/registry.ts';

export const ME = 'a'.repeat(64);
export const OTHER = 'b'.repeat(64);
export const author = (pubkey: string, name = 'Komorebi'): Author => ({
  pubkey,
  npub: `npub1${pubkey.slice(0, 20)}`,
  name,
  picture: 'https://img.example/face.png',
  nip05: 'me@example.jp',
});
export const row = (pubkey = ME, extra: Partial<ProfileRow> = {}): ProfileRow => ({
  kind: 'profile',
  key: `profile:${pubkey}`,
  author: author(pubkey),
  banner: 'https://img.example/band.png',
  about: [{ k: 'text', text: 'Reads. Sometimes writes.' }],
  website: 'https://example.jp',
  lud16: 'me@wallet.example',
  partial: false,
  followed: false,
  followsYou: false,
  self: pubkey === ME,
  muted: false,
  relays: [],
  edit:
    pubkey === ME
      ? {
          name: 'Komorebi',
          about: 'Reads. Sometimes writes.\n#nostr nostr:npub1friend',
          picture: 'https://img.example/face.png',
          banner: 'https://img.example/band.png',
          nip05: '_@example.jp',
          website: 'https://example.jp',
          lud16: 'me@wallet.example',
        }
      : undefined,
  ...extra,
});

export function setup(signer: Account['signer'] = 'local', active = ME) {
  let handlers: SubHandlers | undefined;
  const act = vi.fn<(a: Action, w?: ActWatch) => Promise<ActResult>>(async () => ({
    t: 'result',
    req: 'r',
    ok: true,
  }));
  const instance = `pedit-${crypto.randomUUID()}`;
  const env = {
    instance,
    settings: createSettings(),
    layer: document.createElement('div'),
    visible: createSignal(true),
    open: vi.fn(),
    close: vi.fn(),
    setTitle: vi.fn(),
    menu: vi.fn(),
    engine: {
      me: () => active,
      accounts: createSignal({ active, accounts: [{ author: author(active), signer }] }),
      info: createSignal({ engine: 'fixture', version: 9 }),
      act,
      open: vi.fn((_: unknown, h: SubHandlers) => {
        handlers = h;
        return { window() {}, visible() {}, close() {} };
      }),
    },
  } as unknown as ViewEnv;
  const el = document.createElement('div');
  const field = (f: string) => el.querySelector<HTMLInputElement>(`[data-f="${f}"]`)!;
  const type = (f: string, value: string) => {
    field(f).value = value;
    field(f).dispatchEvent(new Event('input', { bubbles: true }));
  };
  const submit = () =>
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  return { env, el, act, field, type, submit, handlers: () => handlers!, instance };
}
export const flush = () => new Promise((r) => setTimeout(r, 0));
