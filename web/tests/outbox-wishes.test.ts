import { afterEach, expect, it, vi } from 'vitest';
import { kv } from '../src/shared/storage.ts';
import { saveViewState } from '../src/shared/view-state.ts';
import { mountCompose } from '../src/views/compose.ts';
import { createChannelOutbox } from '../src/views/compose-outbox.ts';
import { person, setup } from './wishes-support.ts';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.replaceChildren();
});

it('keeps a failed outgoing draft when Edit cannot save the restored field', () => {
  const x = setup();
  saveViewState(x.env.instance, {
    outbox: [{ as: person.pubkey, draft: { text: 'retained failure' } }],
  });
  const off = mountCompose(x.el, x.env);
  vi.spyOn(kv, 'persist').mockReturnValue(false);
  const edit = [...x.el.querySelectorAll('button')].find((b) => b.textContent === 'Edit')!;
  edit.click();
  expect(x.el.querySelector('textarea')?.value).toBe('');
  expect(x.el.querySelector('.outbox')?.textContent).toContain('retained failure');
  expect(x.el.querySelector('.cresult')?.textContent).toContain('could not be saved');
  off();
});

it('refuses an Edit swap when the current input cannot be retained durably', () => {
  const x = setup();
  const box = createChannelOutbox(
    x.env,
    [],
    () => {},
    () => {},
    () => false,
  );
  vi.spyOn(kv, 'persist').mockReturnValue(false);
  expect(box.retain({ text: 'current input' })).toBe(false);
  box.draw();
  expect(box.el.textContent).not.toContain('current input');
  box.dispose();
});
