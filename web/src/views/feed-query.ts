//! Build a view's declarative want; only the engine chooses physical REQs.
import type { Engine } from '../engine/client.ts';
import type { Query, Source } from '../engine/protocol.ts';
import { rich } from './can.ts';
import { type BarState, typesQuery } from './feed-bar.ts';
import { FILTERED } from './feed-sources.ts';
import { filterQuery } from './filter-bar.ts';

type FeedQueryState = BarState & Pick<Query, 'pubkey' | 'id' | 'ref' | 'tag'>;
export function feedQuery(
  kind: string,
  account: string,
  state: FeedQueryState,
  engine: Engine,
  extra: Partial<Query> = {},
): Query {
  return {
    source: kind as Source,
    account: account || undefined,
    privateLists: !!account,
    pubkey: state.pubkey,
    id: state.id,
    ref: state.ref,
    tag: state.tag,
    ...(kind === 'search' ? { text: '' } : {}),
    ...(kind === 'notifications' ? { types: typesQuery(state.only) } : {}),
    ...(FILTERED.has(kind)
      ? filterQuery(
          { ...state.filter, ...(kind === 'search' ? { text: state.text } : {}) },
          rich(engine),
        )
      : {}),
    ...extra,
  };
}
