import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDmWatch } from '../src/engine/dm-watch.ts';
import { saveViewState } from '../src/shared/view-state.ts';
import { dmFailure } from '../src/views/dm-outbox.ts';
import { mountMessage } from '../src/views/message.ts';
import { mountMessages } from '../src/views/messages.ts';
import { authors, dmEnv, message, OTHER, ROOM } from './dm-ui-fixture.ts';
import { account, deferred, PUBKEY, success, tick } from './vault-ui-fixture.ts';

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
it('opens no private subscription before consent and clears rows synchronously on lock', async () => {
  const x = dmEnv({ signer: 'extension' }),
    stop = mountMessages(x.el, x.env);
  try {
    expect(x.sent.some((m) => m.t === 'dm.open')).toBe(false);
    expect(x.el.textContent).toContain('Read messages');
    x.el.querySelector('button')?.click();
    await tick();
    expect(x.sent.some((m) => m.t === 'dm.open')).toBe(true);
    x.answer({
      people: authors,
      conversations: [{ key: ROOM, participants: [PUBKEY, OTHER], last: message(), unread: 2 }],
    });
    expect(x.el.textContent).toContain('Only inside this private view.');
    x.accounts.set({ active: PUBKEY, accounts: [account({ signer: 'extension', locked: true })] });
    expect(x.el.textContent).toContain('This account is locked.');
    expect(x.el.textContent).not.toContain('Only inside this private view.');
  } finally {
    stop();
    x.dispose();
  }
});
it.each([{ inbox: [] }, { inbox: undefined }])(
  'shows proven missing own inbox setup even with account inbox %s',
  async ({ inbox }) => {
    const x = dmEnv({ inbox }),
      stop = mountMessages(x.el, x.env);
    try {
      await tick();
      x.answer({
        phase: 'unsupported',
        error: 'not-found',
        people: authors,
        conversations: [{ key: ROOM, participants: [PUBKEY, OTHER], last: message(), unread: 1 }],
      });
      expect(x.el.textContent).toContain('Choose relays');
      expect(x.el.textContent).toContain(message().text);
      expect(x.el.textContent).not.toContain('does not support');
      x.answer({ phase: 'loading' });
      expect(x.el.textContent).toContain('Choose relays');
      x.accounts.set({
        active: PUBKEY,
        accounts: [account({ inbox: ['wss://new-inbox.invalid'] })],
      });
      x.answer({ phase: 'live' });
      expect(x.el.textContent).not.toContain('Choose relays');
    } finally {
      stop();
      x.dispose();
    }
  },
);
it('frame watch is protocol8 count-only and releases its subscription when disabled', () => {
  const old = dmEnv({}, 6),
    oldWatch = createDmWatch(old.env.engine, old.env.settings);
  expect(old.sent.some((m) => m.t === 'dm.open')).toBe(false);
  oldWatch.dispose();
  old.dispose();
  const x = dmEnv(),
    watch = createDmWatch(x.env.engine, x.env.settings);
  try {
    expect(x.sent.find((m) => m.t === 'dm.open')).toMatchObject({ query: { unreadOnly: true } });
    x.answer({ unread: 9 });
    expect(watch.unread.get()).toBe(9);
    x.env.settings.patch({ dmWatch: false });
    expect(watch.unread.get()).toBe(0);
    expect(x.sent.at(-1)?.t).toBe('dm.close');
  } finally {
    watch.dispose();
    x.dispose();
  }
});
it('keeps a pending private message out of tab storage and retains partial delivery after its own wrap arrives', async () => {
  const x = dmEnv({ inbox: ['wss://inbox.invalid'] });
  saveViewState(x.env.instance, { participants: [OTHER] });
  const pending = deferred<ReturnType<typeof success>>();
  x.act.mockImplementation(async (action) =>
    action.a === 'dm.send' ? pending.promise : success({ dmDraftRevision: 'fixture-initial' }),
  );
  const stop = mountMessage(x.el, x.env);
  try {
    await tick();
    await tick();
    x.answer({ conversation: ROOM, people: authors, blocked: [] });
    const area = x.el.querySelector<HTMLTextAreaElement>('textarea')!;
    area.value = 'Private outgoing body';
    area.dispatchEvent(new Event('input'));
    (x.el.querySelector('.cbar .btn') as HTMLButtonElement).click();
    await tick();
    await tick();
    expect(area.value).toBe('');
    expect(x.el.textContent).toContain('Sending');
    pending.resolve(
      success({
        ok: false,
        id: 'e'.repeat(64),
        error: { code: 'no-relays' },
        dmDelivery: { accepted: 1, total: 2 },
      }),
    );
    await tick();
    await tick();
    x.answer({
      conversation: ROOM,
      people: authors,
      blocked: [],
      messages: [message({ id: 'e'.repeat(64), author: PUBKEY, text: 'Private outgoing body' })],
    });
    expect(x.el.textContent).toContain('Reached 1 of 2 people');
    expect(localStorage.getItem(`lkjstr:view:${x.env.instance}`)).not.toContain(
      'Private outgoing body',
    );
  } finally {
    stop();
    x.dispose();
  }
});
it('uses signer-specific and participant-specific failure facts without deriving them from relay counts', () => {
  const base = { key: 'fixture', draft: { recipients: [OTHER], text: 'private' } };
  expect(dmFailure({ ...base, error: { code: 'signer-timeout' } })).toBe(
    'The signer did not answer.',
  );
  expect(dmFailure({ ...base, error: { code: 'no-relays' } })).not.toBe(
    'No inbox relay accepted it.',
  );
  expect(dmFailure({ ...base, dmDelivery: { accepted: 0, total: 2 } })).toBe(
    'No inbox relay accepted it.',
  );
});
