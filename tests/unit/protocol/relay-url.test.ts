import { describe, expect, it } from 'vitest';
import { normalizeRelayUrl } from '../../../src/lib/protocol';

describe('normalizeRelayUrl', () => {
  it('defaults bare hosts to secure websocket URLs', () => {
    expect(normalizeRelayUrl('relay.example')).toBe('wss://relay.example/');
    expect(normalizeRelayUrl('relay.example/path')).toBe(
      'wss://relay.example/path',
    );
  });

  it('converts HTTP schemes to websocket schemes', () => {
    expect(normalizeRelayUrl('http://relay.example')).toBe(
      'ws://relay.example/',
    );
    expect(normalizeRelayUrl('https://relay.example')).toBe(
      'wss://relay.example/',
    );
  });

  it('normalizes path, query, and fragment components', () => {
    expect(
      normalizeRelayUrl('wss://relay.example//inbox///?z=last&a=first#ignored'),
    ).toBe('wss://relay.example/inbox?a=first&z=last');
    expect(normalizeRelayUrl('wss://relay.example/nested/path/')).toBe(
      'wss://relay.example/nested/path',
    );
  });

  it('rejects unsupported or malformed relay URLs', () => {
    expect(normalizeRelayUrl('ftp://relay.example')).toBeUndefined();
    expect(normalizeRelayUrl('://missing-scheme')).toBeUndefined();
    expect(normalizeRelayUrl('wss://')).toBeUndefined();
  });
});
