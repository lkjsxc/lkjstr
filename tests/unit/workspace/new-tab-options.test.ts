import { describe, expect, it } from 'vitest';
import { newTabOptions } from '../../../src/lib/tabs/new-tab/new-tab-options';

describe('new tab options', () => {
  it('exposes only direct workspace choices', () => {
    expect(newTabOptions.map((option) => option.label)).toEqual([
      'Timeline',
      'Relay Settings',
      'Relay Monitor',
      'Notifications',
      'Accounts',
      'Tweet',
      'Settings',
      'Cache',
    ]);
  });
});
