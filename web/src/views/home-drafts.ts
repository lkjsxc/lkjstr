// Page-local presentation of the composer's durable outbox. Staged drafts never
// enter the verified event store, row cache, or subscription/reading anchors.
import type { Author, Draft, Failure, Row } from '../engine/protocol.ts';
import { fullTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { ability, failureText } from './can.ts';
import { draftBody, draftButtons } from './draft-row.ts';
import { faceButton, nameButton, nipMark } from './parts.ts';
import type { ViewEnv } from './registry.ts';
import { type Asking, waitKey } from './send-state.ts';

export type HomeDraft = {
  readonly key: string;
  readonly draft: Draft;
  readonly author: Author;
  readonly at: number;
  /** An extension or remote signer, which may be waiting on the reader. */
  readonly asks?: Asking;
  retry(): void;
  discard(): void;
  release(): void;
  signed?: string;
  failure?: Failure;
  waiting?: boolean;
};

// At most 64 draft presentations per page. Eviction only affects the Home
// presentation. The composer still owns the persisted draft and its recovery.
const entries = new Map<string, HomeDraft>();
const watches = new Set<() => void>(); // one per mounted Home
const notify = (): void => {
  for (const watch of watches) watch();
};

export function showHomeDraft(candidate: HomeDraft): void {
  if (!entries.has(candidate.key) && entries.size >= 64) {
    const failed = [...entries.values()].find((entry) => entry.failure);
    if (!failed) return;
    entries.delete(failed.key);
    failed.release();
  }
  entries.set(candidate.key, candidate);
  notify();
}
export function hasHomeDraft(key: string | undefined): boolean {
  return key !== undefined && entries.has(key);
}
export function removeHomeDraft(key: string | undefined): void {
  const entry = key ? entries.get(key) : undefined;
  if (entry && entries.delete(entry.key)) {
    entry.release();
    notify();
  }
}
export function homeDraftForEdit(key: string | undefined, account: string): HomeDraft | undefined {
  const draft = key ? entries.get(key) : undefined;
  return draft?.author.pubkey === account && draft.failure ? draft : undefined;
}

// From Post until the verified note takes its place, the draft carries the Sending mark a signed note carries, however
// long signing takes: the reader sees one steady state. Only an extension or remote signer still waiting after ten
// seconds says so, since the reader can act on it there. `data-phase` and `data-event` stay for the checks.
function renderDraft(entry: HomeDraft, env: ViewEnv): HTMLElement {
  const { asks, author, draft, failure, signed, waiting } = entry;
  const phase = failure ? 'failed' : signed ? 'sending' : 'signing';
  return h(
    'article',
    {
      class: `note home-draft ${failure ? 'cdraft' : 'pending'}`,
      'data-draft': entry.key,
      'data-phase': phase,
      'data-event': signed ?? null,
    },
    h(
      'div',
      { class: 'nrow' },
      faceButton(author, env),
      h(
        'div',
        { class: 'nmain' },
        h(
          'div',
          { class: 'nhead' },
          nameButton(author, env),
          nipMark(author),
          h(
            'time',
            { title: fullTime(entry.at) },
            failure ? '' : t((!signed && waiting && waitKey(asks)) || 'note.sending'),
          ),
        ),
        h('div', { class: 'content' }, draftBody(draft, env)),
        // The room of the action row the signed note will have, so that nothing below moves when it arrives.
        failure ? null : h('div', { class: 'acts', 'aria-hidden': 'true' }),
        failure
          ? h('div', { class: 'cresult' }, h('span', { class: 'error' }, failureText(failure)))
          : null,
        failure
          ? draftButtons(
              false,
              () => {
                if (ability(env.engine) === 'ok') entry.retry();
              },
              () => env.open('compose', { fromHomeDraft: entry.key }),
              entry.discard,
            )
          : null,
      ),
    ),
  );
}

export function mountHomeDrafts(env: ViewEnv) {
  const el = h('div');
  let current: readonly HomeDraft[] = [];
  return {
    el,
    visible: () => current.length > 0,
    count: () => current.filter((entry) => !entry.signed).length,
    draw(rows: readonly Row[]) {
      const account = env.engine.me();
      const next = [...entries.values()]
        .reverse()
        .filter(
          (entry) =>
            entry.author.pubkey === account &&
            !(entry.signed && rows.some((row) => row.key === entry.signed)),
        );
      if (next.length === current.length && next.every((entry, i) => entry === current[i])) return;
      current = next;
      el.replaceChildren(...next.map((entry) => renderDraft(entry, env)));
    },
    watch(watch: () => void) {
      watches.add(watch);
      return () => void watches.delete(watch);
    },
  };
}
