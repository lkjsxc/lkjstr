import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { t } from '../src/shared/i18n.ts';
import { createDmCompose } from '../src/views/dm-compose.ts';
import { inboxRelayEntry } from '../src/views/settings-dm.ts';
import { dmEnv, OTHER } from './dm-ui-fixture.ts';
import { account, success, tick } from './vault-ui-fixture.ts';

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});
it('retains the current private input before editing a failed row, and counts UTF-8 bytes', async () => {
  vi.useFakeTimers();
  const x = dmEnv();
  x.act.mockResolvedValueOnce(
    success({
      dmDraftRevision: 'initial',
      dmDraft: {
        draft: { recipients: [OTHER], text: 'current private input' },
        failed: [
          {
            key: 'failed',
            draft: { recipients: [OTHER], text: 'failed private input' },
            error: { code: 'rejected' },
          },
        ],
      },
    }),
  );
  const compose = createDmCompose({
    env: x.env,
    account: account(),
    peers: [OTHER],
    changed() {},
    known: () => undefined,
  });
  x.el.append(compose.el);
  try {
    await tick();
    await tick();
    const area = x.el.querySelector<HTMLTextAreaElement>('textarea')!;
    [...x.el.querySelectorAll<HTMLButtonElement>('.dm-outbox button')]
      .find((b) => b.textContent === t('compose.edit'))
      ?.click();
    expect(area.value).toBe('current private input');
    const choice = x.env.layer.querySelector<HTMLButtonElement>('[role="menuitem"]');
    expect(choice?.textContent).toBe(t('compose.editWhenEmpty'));
    choice?.click();
    expect(area.value).toBe('failed private input');
    expect(x.el.querySelector('.dm-outbox')?.textContent).toContain('current private input');
    await vi.advanceTimersByTimeAsync(180);
    const save = x.act.mock.calls.map(([a]) => a).find((a) => a.a === 'dm.draft.save');
    expect(save).toMatchObject({
      state: {
        draft: { text: 'failed private input' },
        failed: [{ draft: { text: 'current private input' } }],
      },
    });
    const send = x.el.querySelector<HTMLButtonElement>('.cbar .btn')!;
    area.value = 'あ'.repeat(5462);
    area.dispatchEvent(new Event('input'));
    expect(send.disabled).toBe(true);
    expect(x.el.textContent).toContain(t('dm.tooLong'));
    area.value = 'あ'.repeat(5461);
    area.dispatchEvent(new Event('input'));
    expect(send.disabled).toBe(false);
    expect(x.act.mock.calls.some(([a]) => a.a === 'dm.send')).toBe(false);
  } finally {
    compose.dispose();
    x.dispose();
  }
});
it('keeps inbox relay edits local and permits explicit withdrawal of the last relay', async () => {
  const x = dmEnv({ inbox: ['wss://one.invalid/'] }),
    inbox = inboxRelayEntry(x.env);
  x.el.append(inbox.entry.node);
  try {
    const save = x.el.querySelector<HTMLButtonElement>('.actions .btn')!;
    expect(save.disabled).toBe(true);
    x.el.querySelector<HTMLButtonElement>('.srow button')?.click();
    expect(save.disabled).toBe(false);
    expect(x.act).not.toHaveBeenCalled();
    save.click();
    await tick();
    expect(x.act.mock.calls[0]?.[0]).toMatchObject({ a: 'dm.relays.save', relays: [] });
    expect(save.disabled).toBe(true);
  } finally {
    inbox.dispose();
    x.dispose();
  }
});
