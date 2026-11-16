import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountMessages } from '../src/views/messages.ts';
import { authors, dmEnv, message, OTHER, ROOM } from './dm-ui-fixture.ts';
import { PUBKEY, tick } from './vault-ui-fixture.ts';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});
it('requests a short visible inbox end once per progress and never spins on an unchanged snapshot', async () => {
  const x = dmEnv(),
    stop = mountMessages(x.el, x.env);
  try {
    await tick();
    const conversation = { key: ROOM, participants: [PUBKEY, OTHER], last: message(), unread: 1 };
    x.answer({ more: true, conversations: [conversation], people: authors });
    await vi.advanceTimersByTimeAsync(20);
    expect(x.sent.filter((m) => m.t === 'dm.more')).toHaveLength(1);
    x.answer({ more: true, conversations: [conversation], people: authors });
    await vi.advanceTimersByTimeAsync(100);
    expect(x.sent.filter((m) => m.t === 'dm.more')).toHaveLength(1);
    x.visible.set(false);
    const second = {
      ...conversation,
      key: 'e'.repeat(64),
      last: message({ id: 'f'.repeat(64), at: 1 }),
    };
    x.answer({ more: true, conversations: [conversation, second], people: authors });
    await vi.advanceTimersByTimeAsync(20);
    expect(x.sent.filter((m) => m.t === 'dm.more')).toHaveLength(1);
    x.visible.set(true);
    expect(x.sent.filter((m) => m.t === 'dm.more')).toHaveLength(2);
  } finally {
    stop();
    x.dispose();
  }
});
it('refreshes a late public name while filtering only names, never private message text', async () => {
  const x = dmEnv(),
    stop = mountMessages(x.el, x.env);
  try {
    await tick();
    const conversations = [
      {
        key: ROOM,
        participants: [PUBKEY, OTHER],
        last: message({ text: 'secret-only-match' }),
        unread: 1,
      },
    ];
    x.answer({ conversations, people: authors });
    expect(x.el.querySelector('.list .name')?.textContent).toContain('Other person');
    x.answer({
      conversations,
      people: [authors[0]!, { ...authors[1]!, name: 'Later public name' }],
    });
    expect(x.el.querySelector('.list .name')?.textContent).toContain('Later public name');
    const input = x.el.querySelector<HTMLInputElement>('input')!;
    input.value = 'secret-only-match';
    input.dispatchEvent(new Event('input'));
    expect(x.el.querySelectorAll('.list .chan')).toHaveLength(0);
  } finally {
    stop();
    x.dispose();
  }
});
