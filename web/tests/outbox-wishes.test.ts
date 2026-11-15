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

for (const restored of [false, true])
  it(`preserves both drafts during an Edit swap when restoration ${restored ? 'succeeds' : 'fails'}`, () => {
    const x = setup();
    const media = [{ url: 'https://example.test/outgoing.png', mime: 'image/png', type: 'image' }];
    const inputMedia = [{ ...media[0], url: 'https://example.test/input.png' }];
    saveViewState(x.env.instance, {
      text: 'current input',
      media: inputMedia,
      outbox: [{ as: person.pubkey, draft: { text: 'outgoing draft', media } }],
    });
    let off = mountCompose(x.el, x.env);
    const persist = kv.persist.bind(kv);
    vi.spyOn(kv, 'persist').mockImplementation((key, value) =>
      key === `view:${x.env.instance}` && !restored ? false : persist(key, value),
    );
    [...x.el.querySelectorAll('button')].find((b) => b.textContent === 'Edit')!.click();
    x.env.layer.querySelector<HTMLButtonElement>('[role=menuitem]')!.click();
    expect(x.el.querySelector('textarea')?.value).toBe(restored ? 'outgoing draft' : '');
    expect(x.el.querySelector('.outbox')?.textContent).toContain('current input');
    expect(x.el.querySelector('.outbox')?.textContent?.includes('outgoing draft')).toBe(!restored);
    off();
    vi.restoreAllMocks();
    off = mountCompose(x.el, x.env);
    expect(x.el.querySelector('.outbox')?.textContent).toContain(inputMedia[0]!.url);
    if (!restored) {
      [...x.el.querySelectorAll('button')].find((b) => b.textContent === 'Edit')!.click();
    }
    expect(x.el.querySelector('textarea')?.value).toBe('outgoing draft');
    expect(x.el.querySelector('.thumb.done')?.textContent).toContain(media[0]!.url);
    off();
  });
