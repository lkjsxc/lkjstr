import { describe, expect, it } from 'vitest';
import {
  filterNewTabOptions,
  lkjsxcTimelinePubkey,
  newTabOptionMatches,
  newTabOptionsForAccount,
  newTabOptionsForAccountAndQuery,
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

  it('keeps canonical order for an empty query', () => {
    const options = newTabOptionsForAccount();
    expect(labels(filterNewTabOptions(options, '  '))).toEqual(canonicalLabels);
  });

  it('filters by label', () => {
    expect(labels(newTabOptionsForAccountAndQuery(undefined, 'tweet'))).toEqual(
      ['Tweet'],
    );
  });

  it('filters by description', () => {
    expect(
      labels(newTabOptionsForAccountAndQuery(undefined, 'identity')),
    ).toEqual(['Accounts']);
  });

  it('exposes the fixed lkjsxc public timeline', () => {
    const item = newTabOptionsForAccount().find(
      (option) => option.label === 'lkjsxc',
    );
    expect(item).toMatchObject({
      kind: 'user-timeline',
      config: { pubkey: lkjsxcTimelinePubkey },
    });
    expect(item && newTabOptionMatches(item, 'starter')).toBe(true);
    expect(item && newTabOptionMatches(item, 'public timeline')).toBe(true);
  });

  it('filters by alias', () => {
    expect(
      labels(newTabOptionsForAccountAndQuery(undefined, 'compose')),
    ).toEqual(['Tweet']);
    expect(
      labels(newTabOptionsForAccountAndQuery(undefined, 'firehose')),
    ).toEqual(['Global']);
    expect(labels(newTabOptionsForAccountAndQuery(undefined, 'nip28'))).toEqual(
      ['Public Chat'],
    );
  });

  it('filters by tab kind key', () => {
    expect(
      labels(newTabOptionsForAccountAndQuery(undefined, 'network-stats')),
    ).toEqual(['Stats']);
  });

  it('trims and ignores query case', () => {
    expect(
      labels(newTabOptionsForAccountAndQuery(undefined, '  MeDiA  ')),
    ).toEqual(['Upload Settings']);
  });

  it('keeps My Profile filterable when an account is active', () => {
    const options = newTabOptionsForAccount('abc');
    const profile = options.find((option) => option.label === 'My Profile');
    expect(profile).toMatchObject({
      kind: 'profile',
      config: { pubkey: 'abc' },
    });
    expect(labels(options).indexOf('My Profile')).toBe(8);
    expect(profile && newTabOptionMatches(profile, 'profile')).toBe(true);
    expect(profile && newTabOptionMatches(profile, 'me')).toBe(true);
    expect(
      labels(newTabOptionsForAccountAndQuery('abc', 'my profile')),
    ).toEqual(['My Profile']);
  });

  it('returns no matches for an unknown query', () => {
    expect(newTabOptionsForAccountAndQuery(undefined, 'zzz-not-found')).toEqual(
      [],
    );
  });
});
