import { beforeEach, describe, expect, it } from 'vitest';
import { captureStartupPromise } from '../../../src/lib/app/runtime-log';
import {
  appLogRecords,
  clearAppLogForTests,
} from '../../../src/lib/log/app-log';

describe('runtime startup logging', () => {
  beforeEach(() => clearAppLogForTests());

  it('logs rejected tab startup promises once with bounded context', async () => {
    captureStartupPromise(Promise.reject(new Error('profile denied')), {
      code: 'profile-runtime-start-failed',
      surface: 'profile',
      kind: 'profile',
      tabId: 'profile-tab',
      relayCount: 2,
    });
    captureStartupPromise(Promise.reject(new Error('thread denied')), {
      code: 'thread-runtime-start-failed',
      surface: 'thread',
      kind: 'thread',
      tabId: 'thread-tab',
      relayCount: 3,
    });
    captureStartupPromise(Promise.reject(new Error('notif denied')), {
      code: 'notifications-runtime-start-failed',
      surface: 'notifications',
      kind: 'notifications',
      tabId: 'notifications-tab',
      relayCount: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(appLogRecords()).toEqual([
      expect.objectContaining({
        code: 'profile-runtime-start-failed',
        message: 'profile denied',
        context: expect.objectContaining({ tabId: 'profile-tab' }),
      }),
      expect.objectContaining({
        code: 'thread-runtime-start-failed',
        message: 'thread denied',
        context: expect.objectContaining({ tabId: 'thread-tab' }),
      }),
      expect.objectContaining({
        code: 'notifications-runtime-start-failed',
        message: 'notif denied',
        context: expect.objectContaining({ tabId: 'notifications-tab' }),
      }),
    ]);
  });
});
