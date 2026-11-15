import { t } from '../shared/i18n.ts';
import { layoutKey } from '../shared/layout-store.ts';
import { loadViewState } from '../shared/view-state.ts';
import { kindOf, viewOf } from '../views/registry.ts';
import { views } from './layout.ts';
import { parseLayout } from './layout-parse.ts';
import { presetOf } from './presets.ts';
import { SPACES } from './spaces.ts';
import type { WmStore } from './store.ts';

export function otherTabs(
  store: WmStore,
  family: string,
  current: number,
): { tab: string; title: string; workspace: number }[] {
  return Array.from({ length: SPACES }, (_, i) => i + 1)
    .filter((n) => n !== current)
    .flatMap((n) => {
      const stored = store.get(layoutKey(family, n));
      // Unvisited presets are possible new tabs, not open tabs.
      if (stored === undefined) return [];
      const root = parseLayout(stored) ?? presetOf(n, undefined, family);
      return views(root)
        .filter((tab) => kindOf(tab) !== 'new')
        .map((tab) => ({
          tab,
          workspace: n,
          title:
            loadViewState<{ title: string }>(`${family}${n}:${tab}`).title ||
            (viewOf(tab) ? t(viewOf(tab)!.title) : tab),
        }));
    });
}
