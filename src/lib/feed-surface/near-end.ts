export {
  isNearEnd,
  isNearStart,
  nearEndPixels,
  nearEndThreshold,
} from '$lib/events/feed-window';

import { nearEndThreshold } from '$lib/events/feed-window';

export function nearEndRootMargin(viewportHeight: number): string {
  return `${nearEndThreshold(viewportHeight)}px`;
}
