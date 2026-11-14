// The keys that work in every tab: moving between tabs and tiles, the pairs that go somewhere (G then H), a new
// note, the list of keys, and Escape out of a field. Single keys never fire while typing; the Alt+Shift ones do
// not either, so the same chord can keep its meaning inside text (selecting by word on Apple devices).
import { type KeyId, pressed, typing } from '../shared/keys.ts';
import { popoverOpen } from './menus.ts';

export type WmKeyOps = {
  /** The tab beside the one in front of the current tile (wrapping). */
  tab(dir: 1 | -1): void;
  tile(dir: 1 | -1): void;
  /** The tab in front moves to the next tile. */
  send(): void;
  newTab(): void;
  close(): void;
  reopen(): void;
  /** Shows a tab of this kind in the current tile: the one that is there, or a new one. */
  go(kind: string): void;
  /** Always a new tab. */
  open(kind: string): void;
};

export function mountWmKeys(ops: WmKeyOps): () => void {
  const table: readonly (readonly [KeyId, () => void])[] = [
    ['tabPrev', () => ops.tab(-1)],
    ['tabNext', () => ops.tab(1)],
    ['tilePrev', () => ops.tile(-1)],
    ['tileNext', () => ops.tile(1)],
    ['tabToTile', ops.send],
    ['tabNew', ops.newTab],
    ['tabClose', ops.close],
    ['tabReopen', ops.reopen],
    ['goHome', () => ops.go('home')],
    ['goNotifications', () => ops.go('notifications')],
    ['goBookmarks', () => ops.go('bookmarks')],
    ['compose', () => ops.open('compose')],
    ['help', () => ops.go('shortcuts')],
  ];
  const key = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || popoverOpen()) return;
    const field = e.target as HTMLElement | null;
    if (typing(e)) {
      // One level out of a field: the keyboard goes to the tab it is in, and the single keys work again.
      if (!pressed(e, 'back') || !field?.isConnected) return;
      const view = field.closest<HTMLElement>('.view');
      if (!view) return;
      e.preventDefault();
      if (view.tabIndex < 0) view.tabIndex = -1;
      view.focus({ preventScroll: true });
      if (document.activeElement !== view) field.blur();
      return;
    }
    const hit = table.find(([id]) => pressed(e, id));
    if (hit) e.preventDefault(), hit[1]();
  };
  window.addEventListener('keydown', key);
  return () => window.removeEventListener('keydown', key);
}
