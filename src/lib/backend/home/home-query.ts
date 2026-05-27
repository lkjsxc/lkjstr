import { feedPageSize } from '../../events/feed-window';
import type { TimelineRuntimeOptions } from '../../timeline/timeline-state';
import {
  attachRegistryHomeQuery,
  type HomeQueryAttachment,
} from './home-query-registry';

export type AttachHomeQueryInput = {
  readonly tabId: string;
  readonly activeAccountPubkey?: string | null;
  readonly relays: readonly string[];
  readonly pageSize?: number;
  readonly feedPolicy?: string;
  readonly seed?: TimelineRuntimeOptions['seed'];
  readonly pool?: TimelineRuntimeOptions['pool'];
  readonly subscriptions?: TimelineRuntimeOptions['subscriptions'];
};

export function attachHomeQuery(
  input: AttachHomeQueryInput,
): HomeQueryAttachment {
  return attachRegistryHomeQuery({
    tabId: input.tabId,
    query: {
      accountPubkey: input.activeAccountPubkey,
      relays: input.relays,
      pageSize: input.pageSize ?? feedPageSize,
      feedPolicy: input.feedPolicy,
    },
    seed: input.seed,
    pool: input.pool,
    subscriptions: input.subscriptions,
  });
}
