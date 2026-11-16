// Editing a retained row follows the channel rule: keep the current input before replacing it.
import type { DmDraft, DmFailedDraft } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { openPopover } from '../wm/menus.ts';
import type { createDmDraftStore } from './dm-draft-store.ts';
import type { ViewEnv } from './registry.ts';

export function createDmEditor(o: {
  env: ViewEnv;
  anchor: HTMLElement;
  area: HTMLTextAreaElement;
  store: ReturnType<typeof createDmDraftStore>;
  current(): DmDraft;
}) {
  let stopped = false,
    close: (() => void) | undefined;
  return {
    edit(item: DmFailedDraft): void {
      if (stopped || !o.store.ready()) return;
      const restore = (): void => {
        if (stopped || !o.store.ready()) return;
        const state = o.store.get();
        if (!state.failed.some((row) => row.key === item.key)) return;
        const rest = state.failed.filter((row) => row.key !== item.key);
        o.store.replace({
          draft: item.draft,
          failed: o.area.value ? [{ key: crypto.randomUUID(), draft: o.current() }, ...rest] : rest,
        });
        o.area.focus({ preventScroll: true });
      };
      if (!o.area.value) {
        restore();
        return;
      }
      const button = h(
        'button',
        {
          role: 'menuitem',
          onclick: () => {
            close?.();
            restore();
          },
        },
        t('compose.editWhenEmpty'),
      );
      close = openPopover(o.env.layer, o.anchor, h('div', { class: 'menu', role: 'menu' }, button));
      button.focus({ preventScroll: true });
    },
    dispose(): void {
      stopped = true;
      close?.();
      close = undefined;
    },
  };
}
