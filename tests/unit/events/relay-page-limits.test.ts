import { afterEach, describe, expect, it } from 'vitest';
import { limitedRelayFilterGroups } from '../../../src/lib/events/relay-page-limits';
import {
  clearRelayInformationMemoryForTests,
  saveRelayInformation,
} from '../../../src/lib/relays/relay-info';

describe('relay page limits', () => {
  afterEach(() => clearRelayInformationMemoryForTests());

  it('derives per-relay filter groups from effective budgets', async () => {
    await saveRelayInformation({
      relayUrl: 'wss://small.example/',
      fetchedAt: Date.now(),
      status: 'available',
      info: { limitation: { maxLimit: 2 } },
    });
    const groups = await limitedRelayFilterGroups(
      ['wss://relay.example/', 'wss://small.example/'],
      [{ kinds: [1], limit: 10 }],
      5,
    );
    const limits = groups
      .map((group) => group.filters[0]?.limit)
      .sort((left = 0, right = 0) => left - right);

    expect(limits).toEqual([2, 10]);
    expect(groups.every((group) => group.maxEvents >= 7)).toBe(true);
  });
});
