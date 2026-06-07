import { describe, expect, it } from 'vitest';
import {
  lkjsxcTimelinePubkey,
  newTabOptionsForAccount,
} from '../../../src/lib/tabs/new-tab/new-tab-options';

function labels(options: ReturnType<typeof newTabOptionsForAccount>): string[] {
  return options.map((option) => option.label);
}

const canonicalLabels = [
  'Home',
  'Tweet',
  'Notifications',
  'Search',
  'Custom Request',
  'Global',
  'Public Chat',
  'lkjsxc',
  'Profile Edit',
  'Accounts',
  'Relay Settings',
  'Stats',
  'Settings',
  'Upload Settings',
  'lkjstr Log',
  'Mine npub',
  'Welcome',
];

describe('new tab options', () => {
  it('exposes only direct workspace choices', () => {
    expect(labels(newTabOptionsForAccount())).toEqual(canonicalLabels);
  });

  it('exposes the fixed lkjsxc public timeline', () => {
    const item = newTabOptionsForAccount().find(
      (option) => option.label === 'lkjsxc',
    );
    expect(item).toMatchObject({
      kind: 'user-timeline',
      config: { pubkey: lkjsxcTimelinePubkey },
    });
    expect(item?.aliases).toContain('starter');
    expect(item?.aliases).toContain('public timeline');
  });

  it('inserts My Profile after lkjsxc when an account is active', () => {
    const options = newTabOptionsForAccount('abc');
    const profile = options.find((option) => option.label === 'My Profile');
    expect(profile).toMatchObject({
      kind: 'profile',
      config: { pubkey: 'abc' },
    });
    expect(labels(options).indexOf('My Profile')).toBe(8);
    expect(profile?.aliases).toContain('profile');
    expect(profile?.aliases).toContain('me');
  });
});
