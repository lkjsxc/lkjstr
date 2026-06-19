import { describe, expect, it } from 'vitest';
import {
  eventProfileCanOpen,
  eventProfileOpenLabel,
  openEventProfile,
  stopAndOpenEventProfile,
} from '../../../src/lib/components/events/event-profile-activation';

describe('event profile activation', () => {
  it('plans the retained profile open label', () => {
    expect(eventProfileOpenLabel()).toBe('Open profile');
  });

  it('requires a real opener before opening a profile', () => {
    const opened: string[] = [];

    expect(eventProfileCanOpen(undefined)).toBe(false);
    expect(openEventProfile(undefined, 'pubkey-a')).toBe(false);
    expect(openEventProfile((pubkey) => opened.push(pubkey), 'pubkey-b')).toBe(
      true,
    );
    expect(opened).toEqual(['pubkey-b']);
  });

  it('stops row propagation even when profile opening is unavailable', () => {
    const events: string[] = [];
    const event = {
      stopPropagation: () => events.push('stopped'),
    };

    expect(stopAndOpenEventProfile(event, undefined, 'pubkey-a')).toBe(false);
    expect(events).toEqual(['stopped']);
  });

  it('stops propagation and opens the requested profile', () => {
    const events: string[] = [];
    const opened: string[] = [];
    const event = {
      stopPropagation: () => events.push('stopped'),
    };

    expect(
      stopAndOpenEventProfile(
        event,
        (pubkey) => opened.push(pubkey),
        'pubkey-c',
      ),
    ).toBe(true);
    expect(events).toEqual(['stopped']);
    expect(opened).toEqual(['pubkey-c']);
  });
});
