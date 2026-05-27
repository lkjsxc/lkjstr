import { describe, expect, it } from 'vitest';
import {
  buildNotificationFilters,
  notificationFilterTargetsAccount,
} from '../../../src/lib/notifications/notification-filters';
import { buildTimelineFilters } from '../../../src/lib/query/timeline-filters';

describe('notification-filters', () => {
  const account = 'aa'.repeat(32);

  it('targets #p not authors', () => {
    const filters = buildNotificationFilters({
      accountPubkey: account,
      cursor: {},
      limit: 30,
    });
    expect(filters[0]?.['#p']).toEqual([account]);
    expect(filters[0]?.authors).toBeUndefined();
    expect(notificationFilterTargetsAccount(filters[0]!, account)).toBe(true);
  });

  it('does not match home author filters', () => {
    const home = buildTimelineFilters({
      kind: 'home',
      activePubkey: account,
      followPubkeys: ['bb'.repeat(32)],
      cursor: {},
      limit: 30,
    });
    const notifications = buildNotificationFilters({
      accountPubkey: account,
      cursor: {},
      limit: 30,
    });
    expect(JSON.stringify(home)).not.toEqual(JSON.stringify(notifications));
  });
});
