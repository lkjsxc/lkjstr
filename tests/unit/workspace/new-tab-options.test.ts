import { describe, expect, it } from 'vitest';
import { newTabOptionsForAccount } from '../../../src/lib/tabs/new-tab/new-tab-options';

describe('new tab options', () => {
  it('exposes only direct workspace choices', () => {
    expect(newTabOptionsForAccount().map((option) => option.label)).toEqual([
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

  it('adds My Profile when an account is active', () => {
    const labels = newTabOptionsForAccount('abc').map((option) => option.label);
    expect(labels).toContain('My Profile');
    expect(
      newTabOptionsForAccount('abc').find(
        (option) => option.label === 'My Profile',
      ),
    ).toMatchObject({ kind: 'profile', config: { pubkey: 'abc' } });
  });
});
