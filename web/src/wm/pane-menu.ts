// What a tile's "…" menu offers: the tab in front's own items, then splitting, reopening and closing the tile.
// Maximizing and collapsing are the buttons beside it (render.ts); resetting the layout is in Settings.
import { t } from '../shared/i18n.ts';
import { keyCaps } from '../shared/keys.ts';
import type { PaneNode, Zone } from './layout.ts';
import type { MenuItem } from './menus.ts';

export type PaneMenuOps = {
  /** The tab in front's own items. */
  readonly own: readonly MenuItem[];
  split(zone: Zone): void;
  /** Absent when there is no closed tab to reopen. */
  readonly reopen?: () => void;
  close(): void;
};

export function paneMenu(p: PaneNode, o: PaneMenuOps): MenuItem[] {
  return [
    ...o.own,
    { label: t('pane.splitRight'), run: () => o.split('right'), disabled: p.tabs.length < 2 },
    { label: t('pane.splitDown'), run: () => o.split('bottom'), disabled: p.tabs.length < 2 },
    {
      label: t('pane.reopen'),
      key: keyCaps('tabReopen')[0],
      run: () => o.reopen?.(),
      disabled: !o.reopen,
    },
    { label: t('pane.close'), run: o.close },
  ];
}
