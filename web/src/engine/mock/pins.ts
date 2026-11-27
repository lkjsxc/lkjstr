// A deterministic test double for the engine-owned public pin membership.
import type { Action, Failure } from '../protocol.ts';
import type { Core } from './engine.ts';

export function pin(
  core: Core,
  action: Extract<Action, { a: 'pin' }>,
): Failure['code'] | undefined {
  const { world } = core;
  const note = world.byId.get(action.id);
  if (
    !note ||
    note.by.author.pubkey !== action.as ||
    action.as !== core.me() ||
    note.channel ||
    note.eventKind !== undefined
  )
    return 'rejected';
  const pins = world.state.pins.get(action.as) ?? new Set<string>();
  if (action.on) pins.add(action.id);
  else pins.delete(action.id);
  world.state.pins.set(action.as, pins);
  core.changed(action.id);
  core.resync((query) => query.source === 'pins');
}
