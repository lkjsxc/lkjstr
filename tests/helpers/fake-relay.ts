export type FakeRelayEvent = {
  readonly id: string;
  readonly pubkey: string;
  readonly created_at: number;
  readonly kind: number;
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
  readonly sig: string;
};

export type FakeRelayBatch = {
  readonly subId: string;
  readonly events: readonly FakeRelayEvent[];
  readonly eose?: boolean;
  readonly closeAfterEvents?: boolean;
};

export function fakeRelayMessages(batch: FakeRelayBatch): string[] {
  const messages = batch.events.map(
    (event) => JSON.stringify(['EVENT', batch.subId, event]) as string,
  );
  if (batch.closeAfterEvents && !batch.eose) return messages;
  if (batch.eose !== false)
    messages.push(JSON.stringify(['EOSE', batch.subId]));
  return messages;
}

export function duplicateSameSecond(
  base: FakeRelayEvent,
  ids: readonly string[],
): FakeRelayEvent[] {
  return ids.map((id) => ({ ...base, id, content: id }));
}
