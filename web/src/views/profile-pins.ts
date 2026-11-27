// A profile's pins own a finite view; chronological rows, reading anchors and the rail stay separate.
import type { Subscription } from '../engine/client.ts';
import { applyOps } from '../engine/ops.ts';
import type { Row, SubState } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { ability } from './can.ts';
import { createRowList, type RowList } from './feed-draw.ts';
import type { Keeper } from './feed-place.ts';
import { pauseNoteAudio } from './note-audio.ts';
import { createNoteImageQueue } from './note-image-queue.ts';
import { createPreviewWants } from './preview-wants.ts';
import { createPinPosition } from './profile-pin-position.ts';
import type { ViewEnv } from './registry.ts';

const PAGE = 20;
export function mountProfilePins(
  env: ViewEnv,
  keeper: Keeper,
): {
  seat(header: HTMLElement | undefined, row: Row | undefined): void;
  detach(): void;
  dispose(): void;
} {
  const list = h('div', { class: 'pinrows' });
  const status = h('div', { class: 'fstate muted', role: 'status' });
  const previous = h('button', { class: 'lnk', onclick: () => page(false) }, t('pins.previous'));
  const next = h('button', { class: 'lnk', onclick: () => page(true) }, t('pins.next'));
  const slot = h(
    'section',
    { class: 'ppins', 'aria-label': t('note.pinned'), hidden: true },
    list,
    status,
    h('div', { class: 'pinpages' }, previous, next),
  );
  let owner = '';
  let account = env.engine.me();
  let can = ability(env.engine);
  let sub: Subscription | undefined;
  let rows: Row[] = []; // Bound: one engine window, at most PAGE + 1 rows.
  let state: SubState | undefined;
  let top = true;
  let bottom = true;
  let waiting = false;
  let drawn: RowList | undefined;
  let images: ReturnType<typeof createNoteImageQueue> | undefined;
  let previews: ReturnType<typeof createPreviewWants> | undefined;
  let position: ReturnType<typeof createPinPosition> | undefined;
  let focused: HTMLElement | undefined;
  const paint = (): void => {
    const settle = position?.hold();
    drawn?.draw(rows);
    // Empty completed lists need no section. Pending and failed reads retain their truthful status.
    const key =
      state?.phase === 'failed'
        ? 'pins.failed'
        : (state?.pins?.pending ?? 0) > 0 ||
            (!rows.length && (!bottom || !state || state.phase === 'cache'))
          ? 'pins.loading'
          : (state?.pins?.unavailable ?? 0) > 0
            ? 'pins.unavailable'
            : undefined;
    status.textContent = key ? t(key) : '';
    status.hidden = !key;
    slot.hidden = !sub || (!rows.length && !key);
    previous.hidden = top || !rows.length;
    next.hidden = bottom || !rows.length;
    previous.disabled = next.disabled = waiting;
    settle?.();
    previews?.sync();
  };
  const page = (older: boolean): void => {
    const row = older ? rows.at(-1) : rows[0];
    if (!row || waiting) return;
    waiting = true;
    // Keep one boundary note; no retainAbove window is accumulated in the profile header.
    sub?.window({ key: row.key }, older ? 0 : PAGE, older ? PAGE + 1 : 1, !older);
    paint();
  };
  const open = (): void => {
    sub?.close();
    sub = undefined;
    rows = [];
    state = undefined;
    top = bottom = true;
    waiting = false;
    position?.reset();
    // This paired view requires the pins contract; older engines have no such source.
    if (!owner || (env.engine.info.get()?.version ?? 0) < 18) return paint();
    const header = slot.parentElement;
    if (header && !drawn) {
      const viewport = header.closest<HTMLElement>('.feed') ?? header;
      images = createNoteImageQueue(viewport, env.visible);
      previews = createPreviewWants(slot, () => sub, viewport);
      position = createPinPosition(viewport, list, keeper, () => env.visible.get());
      position.seat(header);
      drawn = createRowList(list, env, false, undefined, images.add);
    }
    sub = env.engine.open(
      { source: 'pins', pubkey: owner, account: account || undefined },
      {
        rows(next, atTop, atBottom) {
          if (waiting) position?.page();
          rows = [...next];
          top = atTop;
          bottom = atBottom;
          waiting = false;
          paint();
        },
        patch(ops) {
          rows = applyOps(rows, ops);
          paint();
        },
        state(next) {
          state = next;
          paint();
        },
      },
      slot,
      { visible: false },
    );
    sub.visible(env.visible.get());
    sub.window('top', 0, PAGE);
    paint();
  };
  const offVisible = env.visible.subscribe((on) => {
    sub?.visible(on);
    if (!on) pauseNoteAudio(slot);
    previews?.sync();
  });
  const offAccounts = env.engine.accounts.subscribe(() => {
    const now = env.engine.me();
    const next = ability(env.engine);
    if (now !== account) {
      account = now;
      can = next;
      open();
    } else if (next !== can) {
      can = next;
      drawn?.clear();
      paint();
    }
  });
  const offInfo = env.engine.info.subscribe(() => {
    if (!sub && owner) open();
  });
  const offSettings = env.settings.subscribe(() => {
    drawn?.clear();
    paint();
  });
  return {
    seat(header, row) {
      if (!header || row?.kind !== 'profile') {
        slot.remove();
        return;
      }
      // Moving this intact slot between redrawn headers preserves note bodies, media and folds.
      if (slot.parentElement !== header) header.append(slot);
      position?.seat(header);
      if (focused?.isConnected && slot.contains(focused)) focused.focus({ preventScroll: true });
      focused = undefined;
      if (owner !== row.author.pubkey) {
        owner = row.author.pubkey;
        slot.dataset.pinsFor = owner;
        open();
      }
    },
    detach() {
      position?.capture();
      const active = document.activeElement;
      focused = active instanceof HTMLElement && slot.contains(active) ? active : undefined;
      slot.remove();
    },
    dispose() {
      offVisible(), offAccounts(), offInfo(), offSettings();
      previews?.dispose(), position?.dispose(), images?.dispose(), drawn?.dispose();
      sub?.close();
      slot.remove();
    },
  };
}
