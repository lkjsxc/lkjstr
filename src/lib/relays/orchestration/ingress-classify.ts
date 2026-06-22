import { feedDisplayKinds } from '../../events/feed-kinds';
import type { NostrEvent } from '../../protocol';
import type { DemandSurface } from './demand-types';

const notificationKinds = new Set([0, 1, 6, 7, 16, 9735]);
const publicChatKinds = new Set([40, 41, 42, 43, 44]);

export function isRenderCriticalForSurface(
  surface: DemandSurface,
  event: NostrEvent,
): boolean {
  if (surface === 'notifications') {
    return notificationKinds.has(event.kind);
  }
  if (surface === 'public-chat') {
    return publicChatKinds.has(event.kind);
  }
  if (
    surface === 'home' ||
    surface === 'global' ||
    surface === 'profile' ||
    surface === 'thread' ||
    surface === 'user-timeline'
  ) {
    return feedDisplayKinds.includes(
      event.kind as (typeof feedDisplayKinds)[number],
    );
  }
  return true;
}
