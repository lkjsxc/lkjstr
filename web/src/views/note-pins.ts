// Pinning changes a public replaceable list; Undo is a fresh inverse edit, never a saved list.
import type { NoteRow } from '../engine/protocol.ts';
import { t } from '../shared/i18n.ts';
import type { MenuItem } from '../wm/menus.ts';
import { toast } from './parts.ts';
import type { ViewEnv } from './registry.ts';

export function pinItems(
  row: NoteRow,
  env: ViewEnv,
  perform: (on: boolean) => Promise<boolean>,
): MenuItem[] {
  // The operation needs protocol 18 and an authored kind-1 note, matching the engine's authority check.
  if (
    (env.engine.info.get()?.version ?? 0) < 18 ||
    !row.mine.own ||
    row.eventKind !== undefined ||
    row.channel
  )
    return [];
  return [
    {
      label: t(row.mine.pinned ? 'act.unpin' : 'act.pin'),
      run: async () => {
        const account = env.engine.me();
        if (row.author.pubkey !== account) return;
        const on = !row.mine.pinned;
        if (!(await perform(on)) || env.engine.me() !== account) return;
        toast(env.layer, t(on ? 'undo.pinned' : 'undo.unpinned'), () => {
          // An account switch must never redirect an old Undo to the new reader's list.
          if (env.engine.me() === account) void perform(!on);
        });
      },
    },
  ];
}
