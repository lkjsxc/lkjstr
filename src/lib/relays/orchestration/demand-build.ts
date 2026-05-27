import type { Demand } from './demand-types';
import type {
  HomeNotesLiveIntent,
  LiveIntent,
  PageIntent,
} from './intent-types';
import { planAuthorWriteRelays } from './route-plan';

export function buildLiveDemand(
  intent: LiveIntent,
  relays: readonly string[],
): Demand {
  return {
    surface: intent.surface,
    phase: 'live',
    relays,
    filters: intent.filters,
    purpose: intent.purpose,
    owner: intent.owner,
    visibility: intent.visibility,
    since: intent.since,
    channel: intent.channel,
  };
}

export async function buildHomeNotesLiveDemand(
  intent: HomeNotesLiveIntent,
): Promise<Demand> {
  const relays = await planAuthorWriteRelays({
    surface: 'home',
    authors: intent.authors,
    selectedRelays: intent.selectedRelays,
  });
  return buildLiveDemand(
    {
      surface: 'home',
      owner: intent.owner,
      channel: 'notes',
      visibility: intent.visibility,
      selectedRelays: intent.selectedRelays,
      filters: intent.filters,
      purpose: 'feed',
      since: Math.max(0, intent.sessionStartedAt - 30),
    },
    relays,
  );
}

export function buildPageDemand(
  intent: PageIntent,
  relays: readonly string[],
): Demand {
  return {
    surface: intent.surface,
    phase: intent.phase,
    relays,
    filters: [],
    purpose: intent.purpose ?? 'feed',
    owner: intent.owner,
    visibility: 'visible',
  };
}
