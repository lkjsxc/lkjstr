const visibleEventPins = new Map<string, Set<string>>();
const openReferencePins = new Map<string, Set<string>>();

export function pinVisibleEvents(owner: string, ids: readonly string[]): void {
  replace(visibleEventPins, owner, ids);
}

export function clearVisibleEventPins(owner: string): void {
  visibleEventPins.delete(owner);
}

export function pinOpenReferences(owner: string, ids: readonly string[]): void {
  replace(openReferencePins, owner, ids);
}

export function clearOpenReferencePins(owner: string): void {
  openReferencePins.delete(owner);
}

export function pinnedEventIds(): Set<string> {
  return new Set([...values(visibleEventPins), ...values(openReferencePins)]);
}

export function clearCachePinsForTests(): void {
  visibleEventPins.clear();
  openReferencePins.clear();
}

function replace(
  target: Map<string, Set<string>>,
  owner: string,
  ids: readonly string[],
): void {
  target.set(owner, new Set(ids.filter(Boolean)));
}

function values(source: Map<string, Set<string>>): string[] {
  return [...source.values()].flatMap((ids) => [...ids]);
}
