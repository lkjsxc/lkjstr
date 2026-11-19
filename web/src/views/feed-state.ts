// Reuse the existing feed status node for relay and private-list completion.
import type { Row, SubState } from '../engine/protocol.ts';
import { fullTime } from '../shared/format.ts';
import { type Key, t } from '../shared/i18n.ts';

export function showFeedState(
  status: HTMLElement,
  signIn: HTMLElement | undefined,
  rows: readonly Row[],
  state: SubState | undefined,
  atBottom: boolean,
  searchHint: boolean,
  accountsUnavailable: boolean,
): void {
  const { empty, key } = feedState(rows, state, atBottom, searchHint, accountsUnavailable);
  if (key !== 'error.internal' && empty && signIn) status.replaceChildren(signIn);
  else status.textContent = key ? t(key) : '';
  status.title = state?.lastArrival
    ? t('feed.lastArrival', { time: fullTime(state.lastArrival) })
    : '';
}
export function feedState(
  rows: readonly Row[],
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
