import { afterEach, describe, expect, it } from 'vitest';
import { bootstrapRelays, DEFAULT_RELAYS, savedRelays } from '../src/engine/startup.ts';

afterEach(() => localStorage.clear());
describe('bootstrap relay choice', () => {
  it('uses one default set until this account has saved settings', () => {
    expect(bootstrapRelays()).toBe(DEFAULT_RELAYS);
    localStorage.setItem('lkjstr:account', JSON.stringify('alice'));
    localStorage.setItem('lkjstr:relays:bob', JSON.stringify([]));
    expect(bootstrapRelays()).toBe(DEFAULT_RELAYS);
    const saved = [{ url: 'wss://local.test/', read: true, write: false, search: true }];
    localStorage.setItem('lkjstr:relays:alice', JSON.stringify(saved));
    expect(bootstrapRelays()).toEqual(saved);
  });
  it('keeps search configuration separate from signed read/write edits', () => {
    const saved = savedRelays('alice', [{ url: 'wss://mine.test/', read: true, write: true }]);
    expect(saved[0]).toEqual({ url: 'wss://mine.test/', read: true, write: true, search: false });
    expect(saved.filter((r) => r.search)).toEqual(DEFAULT_RELAYS.filter((r) => r.search));
    localStorage.setItem('lkjstr:relays:alice', JSON.stringify(saved));
    expect(bootstrapRelays('alice')).toEqual(saved);
    expect(bootstrapRelays('bob')).toBe(DEFAULT_RELAYS);
  });
  it('keeps an explicitly empty list and rejects malformed or oversized storage', () => {
    localStorage.setItem('lkjstr:relays:', '[]');
    expect(bootstrapRelays()).toEqual([]);
    localStorage.setItem('lkjstr:relays:', '[{"url":"https://invalid.test"}]');
    expect(bootstrapRelays()).toBe(DEFAULT_RELAYS);
    localStorage.setItem('lkjstr:relays:', JSON.stringify(Array(9).fill(DEFAULT_RELAYS[0])));
    expect(bootstrapRelays()).toBe(DEFAULT_RELAYS);
  });
});
