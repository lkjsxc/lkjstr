import { describe, expect, it } from 'vitest';
import {
  demandSubscriptionDescriptor,
  pageIntentSubscriptionDescriptor,
} from '../../../src/lib/relays/subscription-descriptor';

describe('subscription descriptors', () => {
  it('labels live feed demands by surface and purpose', () => {
    expect(
      demandSubscriptionDescriptor({
        surface: 'home',
        phase: 'live',
        relays: ['wss://relay.example'],
        filters: [{ kinds: [1] }],
        purpose: 'feed',
        owner: 'owner',
        visibility: 'visible',
      }),
    ).toMatchObject({
      label: 'Home live feed',
      surface: 'home',
      phase: 'live',
      purpose: 'feed',
    });
  });

  it('keeps metadata and route-discovery labels purpose-first', () => {
    expect(
      pageIntentSubscriptionDescriptor({
        surface: 'profile',
        owner: 'owner',
        phase: 'page',
        selectedRelays: ['wss://relay.example'],
        authors: [],
        pageSize: 30,
        direction: 'initial',
        purpose: 'metadata',
      }).label,
    ).toBe('Metadata');
    expect(
      pageIntentSubscriptionDescriptor({
        surface: 'home',
        owner: 'owner',
        phase: 'bootstrap',
        selectedRelays: ['wss://relay.example'],
        authors: [],
        pageSize: 30,
        direction: 'initial',
        purpose: 'route-discovery',
      }).label,
    ).toBe('Route discovery');
  });
});
