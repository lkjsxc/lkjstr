import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCachePinsForTests,
  clearOpenReferencePins,
  clearVisibleEventPins,
  pinOpenReferences,
  pinVisibleEvents,
  pinnedEventIds,
} from '../../../src/lib/cache/pins';

describe('cache pins', () => {
  beforeEach(() => clearCachePinsForTests());

  it('unions owner-scoped visible and open-reference pins', () => {
    pinVisibleEvents('tab-a', ['a', 'b']);
    pinVisibleEvents('tab-b', ['b', 'c']);
    pinOpenReferences('thread-a', ['d']);
    expect([...pinnedEventIds()].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('clears one owner without replacing other tab pins', () => {
    pinVisibleEvents('tab-a', ['a']);
    pinVisibleEvents('tab-b', ['b']);
    pinOpenReferences('thread-a', ['c']);
    clearVisibleEventPins('tab-a');
    clearOpenReferencePins('thread-a');
    expect([...pinnedEventIds()]).toEqual(['b']);
  });
});
