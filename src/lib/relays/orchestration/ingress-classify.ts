import { feedDisplayKinds } from '../../events/feed-kinds';
import type { NostrEvent } from '../../protocol';
import type { DemandSurface } from './demand-types';

const notificationKinds = new Set([0, 1, 6, 7, 16, 9735]);

export function isRenderCriticalForSurface(
  surface: DemandSurface,
  event: NostrEvent,
): boolean {
  if (surface === 'notifications') {
    return notificationKinds.has(event.kind);
  }
  if (
    surface === 'home' ||
    surface === 'global' ||
    surface === 'profile' ||
    surface === 'thread'
  ) {
    return feedDisplayKinds.includes(
      event.kind as (typeof feedDisplayKinds)[number],
    );
  }
  return true;
}
