import { describe, expect, it } from 'vitest';
import { customRequestMode } from '../../../src/lib/custom-request/request-mode';

describe('customRequestMode', () => {
  it('keeps exact lookup filters exact', () => {
    expect(customRequestMode([{ ids: ['a'.repeat(64)] }])).toBe('exact');
    expect(customRequestMode([{ search: 'nostr' }])).toBe('exact');
  });

  it('uses adaptive mode for event-list filters', () => {
    expect(customRequestMode([{ kinds: [1], limit: 30 }])).toBe(
      'adaptive-feed',
    );
  });
});
