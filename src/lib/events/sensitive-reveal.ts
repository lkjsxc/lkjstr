const revealed = new Set<string>();

export function revealSensitiveEvent(eventId: string): void {
  if (eventId) revealed.add(eventId);
}

export function isSensitiveEventRevealed(eventId: string): boolean {
  return revealed.has(eventId);
}

export function clearSensitiveRevealsForTests(): void {
  revealed.clear();
}
