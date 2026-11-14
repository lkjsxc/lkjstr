// Persisted WM layouts: one stored key per layout family and workspace, plus one per family for its workspaces
// (`wm/spaces.ts`). Controllers follow changes live, so a reset (or an edit in another tab) applies everywhere.
import { kv } from './storage.ts';

export const LAYOUT_PREFIX = 'layout:';
/** Workspace 1 keeps the plain family key. */
export const layoutKey = (kind: string, space = 1): string =>
  `${LAYOUT_PREFIX}${kind}${space > 1 ? `:${space}` : ''}`;
export const spacesKey = (kind: string): string => `${LAYOUT_PREFIX}${kind}:spaces`;

export function resetLayouts(): void {
  for (const key of kv.keys(LAYOUT_PREFIX)) kv.remove(key);
}
