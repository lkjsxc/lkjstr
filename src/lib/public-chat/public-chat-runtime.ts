import { upsertEvent } from '$lib/events/repository';
import type { NostrEvent } from '$lib/protocol';
import { createRelaySubscriptionManager } from '$lib/relays/subscription-manager';
import type { RelaySet } from '$lib/relays/relay-store';
import {
  channelDiscoveryPlan,
  channelMessagesPlan,
  channelMetadataPlan,
  ownHidePlan,
  ownMutePlan,
} from './public-chat-filters';
import {
  emptyPublicChatState,
  reducePublicChatEvents,
  selectPublicChatChannel,
} from './public-chat-reducer';
import type {
  PublicChatChannel,
  PublicChatCoverage,
  PublicChatReadPlan,
  PublicChatState,
} from './public-chat-types';

export type PublicChatRuntime = ReturnType<typeof createPublicChatRuntime>;

type ReadEventsResult = {
  readonly events: readonly NostrEvent[];
  readonly coverage: PublicChatCoverage;
};
type LoadResult = {
  readonly state: PublicChatState;
  readonly coverage: PublicChatCoverage;
};

export function createPublicChatRuntime(relaySets: readonly RelaySet[]) {
  const manager = createRelaySubscriptionManager();
  const controllers = new Set<AbortController>();
  let closed = false;

  const readEvents = async (
    plan: PublicChatReadPlan | undefined,
  ): Promise<ReadEventsResult> => {
    if (!plan || plan.relays.length === 0)
      return { events: [], coverage: noRelayCoverage() };
    const controller = new AbortController();
    controllers.add(controller);
    try {
      const result = await manager.readPageDetailed(
        {
          key: plan.key,
          relays: plan.relays,
          filters: plan.filters,
          purpose: plan.purpose,
        },
        { signal: controller.signal, timeoutMs: 6000, maxEvents: 500 },
      );
      await Promise.all(
        result.events.map((item) => upsertEvent(item.event, [item.relay])),
      );
      return {
        events: result.events.map((item) => item.event),
        coverage: coverageFrom(
          plan.relays,
          result.statuses.map((status) =>
            status.timeout || status.closed || status.socketError
              ? `${status.relay}: incomplete`
              : '',
          ),
        ),
      };
    } finally {
      controllers.delete(controller);
    }
  };

  return {
    discoverChannels: async (): Promise<LoadResult> => {
      const channelRead = await readEvents(channelDiscoveryPlan(relaySets));
      let state = reducePublicChatEvents(
        emptyPublicChatState(),
        channelRead.events,
      );
      const metadataRead = await readEvents(
        channelMetadataPlan(relaySets, state.channels),
      );
      state = reducePublicChatEvents(state, metadataRead.events);
      return {
        state,
        coverage: mergeCoverage(channelRead.coverage, metadataRead.coverage),
      };
    },
    openChannelById: async (channelId: string): Promise<LoadResult> => {
      const plan: PublicChatReadPlan = {
        key: `public-chat:open:${channelId}`,
        relays: channelDiscoveryPlan(relaySets).relays,
        filters: [{ ids: [channelId], kinds: [40], limit: 1 }],
        purpose: 'event-lookup',
      };
      const read = await readEvents(plan);
      return {
        state: reducePublicChatEvents(emptyPublicChatState(), read.events),
        coverage: read.coverage,
      };
    },
    loadMessages: async (
      state: PublicChatState,
      channel: PublicChatChannel,
      activePubkey?: string,
    ): Promise<LoadResult> => {
      let next = selectPublicChatChannel(state, channel.id);
      const messages = await readEvents(
        channelMessagesPlan(relaySets, channel),
      );
      next = reducePublicChatEvents(
        next,
        messages.events,
        messages.coverage.relays,
      );
      if (activePubkey) {
        const ids = next.messages.map((message) => message.eventId);
        const authors = next.messages.map((message) => message.pubkey);
        const hides = await readEvents(
          ownHidePlan(relaySets, activePubkey, ids),
        );
        const mutes = await readEvents(
          ownMutePlan(relaySets, activePubkey, authors),
        );
        next = reducePublicChatEvents(next, [...hides.events, ...mutes.events]);
      }
      return { state: next, coverage: messages.coverage };
    },
    close: (): void => {
      if (closed) return;
      closed = true;
      for (const controller of controllers) controller.abort();
      controllers.clear();
      manager.close();
    },
  };
}

function noRelayCoverage(): PublicChatCoverage {
  return {
    relays: [],
    incomplete: true,
    diagnostics: ['No read relays selected.'],
  };
}

function coverageFrom(
  relays: readonly string[],
  diagnostics: readonly string[],
): PublicChatCoverage {
  const compact = diagnostics.filter(Boolean).slice(0, 20);
  return { relays, incomplete: compact.length > 0, diagnostics: compact };
}

function mergeCoverage(
  a: PublicChatCoverage,
  b: PublicChatCoverage,
): PublicChatCoverage {
  return {
    relays: [...new Set([...a.relays, ...b.relays])],
    incomplete: a.incomplete || b.incomplete,
    diagnostics: [...a.diagnostics, ...b.diagnostics].slice(0, 20),
  };
}
