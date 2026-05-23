import { describe, expect, it } from 'vitest';
import { newTabOptions } from '../../../src/lib/tabs/new-tab/new-tab-options';

describe('new tab options', () => {
  it('exposes only direct workspace choices', () => {
    expect(newTabOptions.map((option) => option.label)).toEqual([
      'Home',
      'Tweet',
      'Notifications',
      'Search',
      'Custom Request',
      'Global',
      'Profile Edit',
      'Accounts',
      'Relay Settings',
      'Stats',
      'Settings',
      'Upload Settings',
      'lkjstr Log',
      'Mine npub',
      'Welcome',
    ]);
  });
});
