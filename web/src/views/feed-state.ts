// Reuse the existing feed status node for relay and private-list completion.
import type { SubState } from '../engine/protocol.ts';
import { fullTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import type { BarState } from './feed-bar.ts';
import type { ListRow } from './feed-draw.ts';
import type { MomentState } from './feed-moment.ts';
import type { Place } from './feed-place.ts';
import type { ViewEnv } from './registry.ts';
import type { ThreadState } from './thread.ts';

export type FeedState = BarState & {
  title?: string;
  pubkey?: string;
  id?: string;
  ref?: string;
  tag?: string;
  show?: string;
  pos?: Place;
  extent?: number;
  head?: string;
} & ThreadState &
  MomentState;

/** What an account's own list shows a visitor in place of an empty line. */
export const signInButton = (env: ViewEnv): HTMLElement =>
  h('button', { class: 'btn primary', onclick: () => env.open('account') }, t('bar.signedOut'));

export function showFeedState(
  status: HTMLElement,
  signIn: HTMLElement | undefined,
  rows: readonly ListRow[],
  state: SubState | undefined,
  atBottom: boolean,
  searchHint: boolean,
  accountsUnavailable: boolean,
  hasDraft: boolean,
): void {
  const { empty, key } = feedState(rows, state, atBottom, searchHint, accountsUnavailable);
  if (key !== 'error.internal' && empty && signIn) status.replaceChildren(signIn);
  else if (key === 'feed.empty' && hasDraft) status.replaceChildren();
  else status.textContent = key ? t(key) : '';
  status.title = state?.lastArrival
    ? t('feed.lastArrival', { time: fullTime(state.lastArrival) })
    : '';
}
export function feedState(
  rows: readonly ListRow[],
  state: SubState | undefined,
  bottom: boolean,
  searchHint: boolean,
  accountsUnavailable = false,
): { empty: boolean; key: Key | null } {
  const empty = rows.every((r) => r.kind === 'profile' || r.kind === 'channel');
  const phase = state?.phase ?? 'cache',
    privatePhase = state?.privateLists?.phase,
    zapPhase = state?.zapEvidence?.phase;
  const key: Key | null =
    accountsUnavailable || (phase === 'failed' && state?.error === 'internal')
      ? 'error.internal'
      : privatePhase && privatePhase !== 'ready'
        ? privatePhase === 'loading'
          ? 'feed.loading'
          : 'feed.failed'
        : !empty
          ? bottom && rows.length > 8 && (zapPhase === undefined || zapPhase === 'ready')
            ? 'feed.end'
            : null
          : searchHint
            ? 'feed.searchHint'
            : phase === 'cache' || zapPhase === 'loading'
              ? 'feed.loading'
              : phase === 'failed' || zapPhase === 'failed' || zapPhase === 'unsupported'
                ? 'feed.failed'
                : 'feed.empty';
  return { empty, key };
}
