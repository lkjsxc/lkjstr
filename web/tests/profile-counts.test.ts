import { expect, it } from 'vitest';
import { SELF } from '../src/engine/mock/people.ts';
import { profileRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import { createSignal } from '../src/shared/signal.ts';
import type { ViewEnv } from '../src/views/registry.ts';
import { renderProfile } from '../src/views/rows.ts';

it('following remains exact, including zero, when follower discovery is partial', () => {
  const env = {
    engine: { accounts: createSignal({ accounts: [] }), info: createSignal({ version: 5 }) },
  } as unknown as ViewEnv;
  const row = profileRow(createWorld(1_800_000_000_000), SELF, '');
  for (const following of [0, 150]) {
    const el = renderProfile({ ...row, following, followers: 1, partial: true }, env);
    expect(el.querySelector('.pstats button')?.textContent).toBe(`${following} following`);
    expect(el.querySelectorAll('.pstats button')[1]?.textContent).toBe('1 followers');
  }
});
