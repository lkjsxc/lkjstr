import type { DemandSurface } from './demand-types';

export type SurfaceRoutingInput = {
  readonly surface: DemandSurface;
  readonly selectedReadRelays: readonly string[];
  readonly authorWriteRelays?: readonly string[];
  readonly accountReadRelays?: readonly string[];
  readonly hintRelays?: readonly string[];
};

export function relaysForSurfaceDemand(input: SurfaceRoutingInput): string[] {
  const selected = [...input.selectedReadRelays];
  if (input.surface === 'profile' && input.authorWriteRelays?.length) {
    return uniqueRelays([...input.authorWriteRelays, ...selected]);
  }
  if (input.surface === 'notifications' && input.accountReadRelays?.length) {
    return uniqueRelays([...input.accountReadRelays, ...selected]);
  }
  if (input.surface === 'thread' && input.hintRelays?.length) {
    return uniqueRelays([...input.hintRelays, ...selected]);
  }
  return uniqueRelays(selected);
}

function uniqueRelays(relays: readonly string[]): string[] {
  return [...new Set(relays.filter(Boolean))].sort();
}
