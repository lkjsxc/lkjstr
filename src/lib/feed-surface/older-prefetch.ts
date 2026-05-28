import { isNearEnd } from './near-end';
import type { OlderLoadMode } from './older-load-mode';

export function shouldStartOlderPrefetch(input: {
  readonly mode?: OlderLoadMode;
  readonly itemCount: number;
  readonly hasOlder: boolean;
  readonly loadingOlder: boolean;
  readonly cursorsReady: boolean;
  readonly scrollOffset: number;
  readonly viewportSize: number;
  readonly scrollSize: number;
}): boolean {
  if (!input.cursorsReady || input.itemCount === 0) return false;
  if (!input.hasOlder || input.loadingOlder) return false;
  if (input.viewportSize <= 0 || input.scrollSize <= 0) return false;
  if (input.mode === 'fill-then-user-scroll')
    return input.scrollSize <= input.viewportSize;
  if (input.mode !== 'auto-near-end') return false;
  return isNearEnd(input.scrollOffset, input.viewportSize, input.scrollSize);
}
