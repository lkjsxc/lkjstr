import type { RelayReadRequest } from '../events/types';
import type {
  RelaySubscriptionDescriptor,
  RelaySubscriptionDescriptorInput,
} from './types';
import type { RelayRequestPurpose } from './relay-request-compat';
import type { Demand } from './orchestration/demand-types';
import type { PageIntent } from './orchestration/intent-types';

export function demandSubscriptionDescriptor(
  demand: Demand,
): RelaySubscriptionDescriptorInput {
  return descriptor({
    surface: demand.surface,
    phase: demand.phase,
    purpose: demand.purpose,
  });
}

export function pageIntentSubscriptionDescriptor(
  intent: PageIntent,
): RelaySubscriptionDescriptorInput {
  return descriptor({
    surface: intent.surface,
    phase: intent.phase,
    purpose: intent.purpose ?? 'feed',
  });
}

export function requestSubscriptionDescriptor(
  request: RelayReadRequest,
): RelaySubscriptionDescriptorInput {
  return request.descriptor ?? descriptor({ purpose: request.purpose });
}

export function descriptorWithId(
  id: string,
  input: RelaySubscriptionDescriptorInput,
): RelaySubscriptionDescriptor {
  return { id, ...input };
}

function descriptor(input: {
  readonly surface?: string;
  readonly phase?: string;
  readonly purpose?: RelayRequestPurpose;
}): RelaySubscriptionDescriptorInput {
  return {
    ...input,
    label: labelFor(input.surface, input.phase, input.purpose),
  };
}

function labelFor(
  surface: string | undefined,
  phase: string | undefined,
  purpose: RelayRequestPurpose | undefined,
): string {
  if (purpose === 'metadata') return 'Metadata';
  if (purpose === 'route-discovery') return 'Route discovery';
  if (purpose === 'event-lookup') return 'Event lookup';
  if (purpose === 'search') return 'Search read';
  if (!surface) return phase === 'live' ? 'Live feed' : 'Page read';
  const name = surfaceLabel(surface);
  if (phase === 'live') return `${name} live feed`;
  if (phase === 'bootstrap') return `${name} bootstrap read`;
  return `${name} page read`;
}

function surfaceLabel(surface: string): string {
  return surface
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
