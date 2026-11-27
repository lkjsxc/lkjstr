import type { Delivery, Draft, Failure, NoteOutboxStatus } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { draftButtons, draftMedia, draftText } from './draft-row.ts';
import { ownPublished } from './own-published.ts';
import { toast } from './parts.ts';
import type { ViewEnv } from './registry.ts';
import { sendClass, sendPhase, sendWords } from './send-state.ts';

export type ChannelDraft = {
  as: string;
  draft: Draft;
  error?: Failure;
  delivery?: readonly Delivery[];
  signed?: string;
  noteKey?: string;
  notePhase?: NoteOutboxStatus['phase'];
  attempts?: number;
  discarding?: boolean;
  homeKey?: string;
  homeAt?: number;
};
export type Watch = {
  draw(): void;
  delivery(
    relays: readonly Delivery[],
    final: boolean,
    error?: Failure,
    id?: string,
    ms?: number,
    retrying?: number,
  ): void;
};
export type Box = {
  id: string;
  drafts: ChannelDraft[];
  busy: Set<ChannelDraft>;
  /** Sends whose extension or remote signer has kept the reader waiting ten seconds (bound: `busy`). */
  waiting: Set<ChannelDraft>;
  listeners: Set<Watch>;
  /** Each send follows its own late answers (bound: the drafts here, plus the latest once settled). */
  watches: Map<ChannelDraft, AbortController>;
  /** The send the composer's result line follows. */
  latest?: ChannelDraft;
  noteWatches: Map<ChannelDraft, () => void>;
};
// One entry per mounted composer or unsettled send; released when both are gone.
export const boxes = new Map<string, Box>();
let defaultNoticeShown = false;
export function announceDefaults(env: ViewEnv): void {
  if (defaultNoticeShown) return;
  defaultNoticeShown = true;
  try {
    const key = 'lkjstr:default-relays-notice';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    // Keep the notice once per document when storage is denied.
  }
  toast(env.layer, t('compose.defaultRelays'));
}

export function outboxRow(
  item: ChannelDraft,
  env: ViewEnv,
  pending: boolean,
  who: Key | undefined,
  actions: { retry(): void; edit(): void; discard(): void },
): HTMLElement {
  const durable = item.noteKey && item.signed;
  const phase =
    item.notePhase === 'retrying' || item.notePhase === 'refused'
      ? item.notePhase
      : sendPhase(
          pending || (!!durable && item.notePhase !== undefined),
          item.signed,
          item.delivery,
        );
  const canEdit = !durable || item.notePhase === 'refused' || item.notePhase === undefined;
  return h(
    'div',
    { class: 'cresult cdraft', 'data-phase': phase, 'data-event': item.signed ?? null },
    draftText(item.draft, env),
    ...draftMedia(item.draft),
    h(
      'div',
      { class: sendClass(phase) },
      sendWords(phase, item.delivery, item.error, who, item.attempts),
    ),
    draftButtons(
      pending && !durable,
      item.noteKey ? undefined : actions.retry,
      canEdit && (item.signed || !item.noteKey) ? actions.edit : undefined,
      actions.discard,
    ),
  );
}

export function followSignedNote(
  item: ChannelDraft,
  box: Box,
  env: ViewEnv,
  callbacks: { remove(item: ChannelDraft): void; notify(): void; delivered: Watch['delivery'] },
): void {
  const { remove, notify, delivered } = callbacks;
  const noteKey = item.noteKey;
  if (!noteKey || box.noteWatches.has(item)) return;
  const off = env.engine.noteOutbox?.watch(noteKey, (state) => {
    if (!state) {
      if (item.discarding) return remove(item);
      if (box.busy.has(item)) return;
      item.notePhase = undefined;
      if (!item.signed) item.noteKey = undefined; // A reload can interrupt an unsigned draft.
      box.noteWatches.get(item)?.();
      box.noteWatches.delete(item);
      notify();
      return;
    }
    item.signed = state.id;
    if (state.phase === 'discarded') return remove(item);
    if (state.phase === 'sent') {
      ownPublished(item.as);
      if (box.latest === item || !box.latest) delivered(state.delivery, true, undefined, state.id);
      return remove(item);
    }
    if (
      item.notePhase === state.phase &&
      item.attempts === state.attempts &&
      (state.phase === 'sending' ||
        JSON.stringify(item.delivery) === JSON.stringify(state.delivery))
    )
      return;
    item.notePhase = state.phase;
    if (state.phase === 'refused') {
      box.noteWatches.get(item)?.();
      box.noteWatches.delete(item);
    }
    item.attempts = state.attempts;
    if (state.phase !== 'sending') {
      item.delivery = state.delivery;
      if (box.latest === item || !box.latest)
        delivered(
          state.delivery,
          true,
          undefined,
          state.id,
          undefined,
          state.phase === 'retrying' ? state.attempts : undefined,
        );
    }
    notify();
  });
  if (off) box.noteWatches.set(item, off);
}
