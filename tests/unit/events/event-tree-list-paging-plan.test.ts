import { describe, expect, it } from 'vitest';
import {
  canAttemptEventTreeListAutoFill,
  canRequestEventTreeListOlder,
  eventTreeListAutoFillIntentState,
  eventTreeListNearEndEnabled,
  shouldRequestEventTreeListNewer,
  shouldScheduleEventTreeListNewerCheck,
  shouldPrefetchEventTreeListOlder,
} from '../../../src/lib/components/events/event-tree-list-paging-plan';

describe('event tree list paging plan', () => {
  it('enables near-end only for real pageable rows with a callback', () => {
    const base = {
      pagingEnabled: true,
      rowCount: 2,
      hasOlder: true,
      loadingOlder: false,
      hasOnNearEnd: true,
    };

    expect(eventTreeListNearEndEnabled(base)).toBe(true);
    expect(eventTreeListNearEndEnabled({ ...base, pagingEnabled: false })).toBe(
      false,
    );
    expect(eventTreeListNearEndEnabled({ ...base, rowCount: 0 })).toBe(false);
    expect(eventTreeListNearEndEnabled({ ...base, hasOlder: false })).toBe(
      false,
    );
    expect(eventTreeListNearEndEnabled({ ...base, loadingOlder: true })).toBe(
      false,
    );
    expect(eventTreeListNearEndEnabled({ ...base, hasOnNearEnd: false })).toBe(
      false,
    );
  });

  it('caps viewport-fill attempts until the intent resets them', () => {
    const intentState = eventTreeListAutoFillIntentState;
    const base = {
      autoFillPending: false,
      loadingOlder: false,
      hasOlder: true,
      attempts: 0,
    };

    expect(canAttemptEventTreeListAutoFill(base)).toBe(true);
    for (const patch of [
      { autoFillPending: true },
      { loadingOlder: true },
      { hasOlder: false },
      { attempts: 4 },
    ])
      expect(canAttemptEventTreeListAutoFill({ ...base, ...patch })).toBe(
        false,
      );
    expect(canAttemptEventTreeListAutoFill({ ...base, attempts: 3 })).toBe(
      true,
    );
    expect(
      intentState({ currentIntentKey: 'a', nextIntentKey: 'a', attempts: 3 }),
    ).toEqual({ changed: false, intentKey: 'a', attempts: 3 });
    expect(
      intentState({ currentIntentKey: 'a', nextIntentKey: 'b', attempts: 3 }),
    ).toEqual({ changed: true, intentKey: 'b', attempts: 0 });
  });

  it('delegates viewport prefetch to the shared older-prefetch rules', () => {
    const base = {
      mode: 'auto-near-end' as const,
      rowCount: 3,
      hasOlder: true,
      loadingOlder: false,
      cursorsReady: true,
      scrollOffset: 700,
      viewportSize: 300,
      scrollSize: 1000,
    };

    expect(shouldPrefetchEventTreeListOlder(base)).toBe(true);
    expect(shouldPrefetchEventTreeListOlder({ ...base, rowCount: 0 })).toBe(
      false,
    );
    expect(
      shouldPrefetchEventTreeListOlder({ ...base, cursorsReady: false }),
    ).toBe(false);
    expect(
      shouldPrefetchEventTreeListOlder({
        ...base,
        mode: 'fill-then-user-scroll',
        scrollSize: 299,
      }),
    ).toBe(true);
    expect(
      shouldPrefetchEventTreeListOlder({
        ...base,
        mode: 'after-user-scroll',
      }),
    ).toBe(false);
  });

  it('requires rows and shared request-mode approval before loading older rows', () => {
    const base = {
      loadingOlder: false,
      hasOlder: true,
      rowCount: 2,
      mode: 'auto-near-end' as const,
      trigger: 'near-end' as const,
      scrollable: true,
    };

    expect(canRequestEventTreeListOlder(base)).toBe(true);
    expect(canRequestEventTreeListOlder({ ...base, loadingOlder: true })).toBe(
      false,
    );
    expect(canRequestEventTreeListOlder({ ...base, hasOlder: false })).toBe(
      false,
    );
    expect(canRequestEventTreeListOlder({ ...base, rowCount: 0 })).toBe(false);
    expect(
      canRequestEventTreeListOlder({
        ...base,
        mode: 'after-user-scroll',
        trigger: 'near-end',
      }),
    ).toBe(false);
    expect(
      canRequestEventTreeListOlder({
        ...base,
        mode: 'after-user-scroll',
        trigger: 'scroll',
      }),
    ).toBe(true);
    expect(
      canRequestEventTreeListOlder({
        ...base,
        mode: 'fill-then-user-scroll',
        trigger: 'near-end',
        scrollable: false,
      }),
    ).toBe(true);
    expect(
      canRequestEventTreeListOlder({
        ...base,
        mode: 'fill-then-user-scroll',
        trigger: 'near-end',
        scrollable: true,
      }),
    ).toBe(false);
  });

  it('schedules newer checks only for pageable rows with newer work available', () => {
    const base = {
      pagingEnabled: true,
      rowCount: 2,
      hasNewer: true,
      loadingNewer: false,
      newerLoadPending: false,
    };

    expect(shouldScheduleEventTreeListNewerCheck(base)).toBe(true);
    expect(
      shouldScheduleEventTreeListNewerCheck({
        ...base,
        pagingEnabled: false,
      }),
    ).toBe(false);
    expect(
      shouldScheduleEventTreeListNewerCheck({ ...base, rowCount: 0 }),
    ).toBe(false);
    expect(
      shouldScheduleEventTreeListNewerCheck({ ...base, hasNewer: false }),
    ).toBe(false);
    expect(
      shouldScheduleEventTreeListNewerCheck({ ...base, loadingNewer: true }),
    ).toBe(false);
    expect(
      shouldScheduleEventTreeListNewerCheck({
        ...base,
        newerLoadPending: true,
      }),
    ).toBe(false);
  });

  it('requests newer rows only from a real near-start edge', () => {
    const canRequest = shouldRequestEventTreeListNewer;
    const base = {
      pagingEnabled: true,
      nearStart: true,
      hasNewer: true,
      loadingNewer: false,
    };

    expect(canRequest(base)).toBe(true);
    expect(canRequest({ ...base, pagingEnabled: false })).toBe(false);
    expect(canRequest({ ...base, nearStart: false })).toBe(false);
    expect(canRequest({ ...base, hasNewer: false })).toBe(false);
    expect(canRequest({ ...base, loadingNewer: true })).toBe(false);
  });
});
