// Reuse the existing feed status node for relay and private-list completion.
import type { Row, SubState } from '../engine/protocol.ts';
import type { Key } from '../shared/i18n.ts';
export function feedState(
  rows: readonly Row[],
  state: SubState | undefined,
  bottom: boolean,
  searchHint: boolean,
): { empty: boolean; key: Key | null } {
  const empty = rows.every((r) => r.kind === 'profile' || r.kind === 'channel');
  const phase = state?.phase ?? 'cache',
    privatePhase = state?.privateLists?.phase,
    zapPhase = state?.zapEvidence?.phase;
  const key: Key | null =
    privatePhase && privatePhase !== 'ready'
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
