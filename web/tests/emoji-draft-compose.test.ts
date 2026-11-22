import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Action } from '../src/engine/protocol.ts';
import type { Picked } from '../src/shared/emoji-used.ts';
import { t } from '../src/shared/i18n.ts';
import { mountCompose } from '../src/views/compose.ts';
import { createDmCompose } from '../src/views/dm-compose.ts';
import { dmEnv, OTHER } from './dm-ui-fixture.ts';
import { account, success, tick } from './vault-ui-fixture.ts';
import { setup } from './wishes-support.ts';

const chosen = vi.hoisted(() => ({ value: undefined as Picked | undefined }));
vi.mock('../src/views/emoji-picker.ts', () => ({
  openEmojiPicker: (_env: unknown, _anchor: unknown, pick: (value: Picked) => void) => {
    if (chosen.value) pick(chosen.value);
  },
}));
const a = 'https://first.test/pien.png';
const b = 'https://second.test/pien.png';
const picks: Picked[] = [
  { emoji: ':pien:', url: a },
  { emoji: ':pien:', url: b },
];
const expected = [
  { code: 'pien', url: a },
  { code: 'pien_2', url: b },
];
function chooseBoth(el: HTMLElement, values = picks): void {
  const button = el.querySelector<HTMLButtonElement>(`[aria-label="${t('compose.emoji')}"]`)!;
  for (const value of values) {
    chosen.value = value;
    button.click();
  }
  expect(el.querySelector('textarea')?.value).toBe(':pien::pien_2:');
}
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  document.body.replaceChildren();
  localStorage.clear();
});

it('the public composer sends both picked pictures under distinct shortcodes', async () => {
  const x = setup();
  const calls: Action[] = [];
  x.engine.act = async (action) => {
    calls.push(action);
    return success();
  };
  const dispose = mountCompose(x.el, x.env);
  try {
    chooseBoth(x.el);
    x.el.querySelector<HTMLButtonElement>('.primary')!.click();
    await tick();
    await tick();
    expect(calls).toContainEqual(
      expect.objectContaining({
        a: 'publish',
        what: expect.objectContaining({
          draft: expect.objectContaining({
            text: ':pien::pien_2:',
            emoji: expected,
          }),
        }),
      }),
    );
  } finally {
    dispose();
  }
});

it('the private composer saves both pictures only through its private draft action', async () => {
  const x = dmEnv();
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
    chooseBoth(
      x.el,
      picks.map((pick) => ({ ...pick, address: `30030:${'c'.repeat(64)}:set` })),
    );
    await vi.advanceTimersByTimeAsync(201);
    expect(x.act.mock.calls.map(([action]) => action)).toContainEqual(
      expect.objectContaining({
        a: 'dm.draft.save',
        state: expect.objectContaining({
          draft: expect.objectContaining({
            text: ':pien::pien_2:',
            emoji: expected,
          }),
        }),
      }),
    );
    expect(
      [...Array(localStorage.length)]
        .map((_, i) => localStorage.getItem(localStorage.key(i)!))
        .join(''),
    ).not.toContain('pien');
  } finally {
    compose.dispose();
    x.dispose();
  }
});

it('a deleted shortcode no longer reserves its old picture when the next pick is inserted', async () => {
  const x = setup();
  const calls: Action[] = [];
  x.engine.act = async (action) => {
    calls.push(action);
    return success();
  };
  const dispose = mountCompose(x.el, x.env);
  try {
    const button = x.el.querySelector<HTMLButtonElement>(`[aria-label="${t('compose.emoji')}"]`)!;
    chosen.value = picks[0];
    button.click();
    const area = x.el.querySelector('textarea')!;
    area.value = '';
    area.dispatchEvent(new Event('input'));
    chosen.value = picks[1];
    button.click();
    expect(area.value).toBe(':pien:');
    x.el.querySelector<HTMLButtonElement>('.primary')!.click();
    await tick();
    await tick();
    expect(calls).toContainEqual(
      expect.objectContaining({
        a: 'publish',
        what: expect.objectContaining({
          draft: expect.objectContaining({
            text: ':pien:',
            emoji: [{ code: 'pien', url: b }],
          }),
        }),
      }),
    );
  } finally {
    dispose();
  }
});
