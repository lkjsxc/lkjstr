const visibleEventPins = new Set<string>();
const openReferencePins = new Set<string>();

export function pinVisibleEvents(ids: readonly string[]): void {
  replace(visibleEventPins, ids);
}

export function pinOpenReferences(ids: readonly string[]): void {
  replace(openReferencePins, ids);
}

export function pinnedEventIds(): Set<string> {
  return new Set([...visibleEventPins, ...openReferencePins]);
}

export function clearCachePinsForTests(): void {
  visibleEventPins.clear();
  openReferencePins.clear();
}

function replace(target: Set<string>, ids: readonly string[]): void {
  target.clear();
  ids.filter(Boolean).forEach((id) => target.add(id));
}
