import type { Delivery, NoteOutboxStatus } from '../protocol.ts';
import type { Core } from './engine.ts';

export function createMockNoteOutbox({ post, world, resync }: Core) {
  const entries = new Map<string, NoteOutboxStatus>(); // At most 64 fixture publications.
  return {
    set(note: NoteOutboxStatus): void {
      if (entries.get(note.key)?.phase === 'discarded') return;
      if (entries.size >= 64 && !entries.has(note.key))
        entries.delete(entries.keys().next().value ?? '');
      entries.set(note.key, note);
    },
    query(keys: readonly string[]): void {
      post({
        t: 'note.outbox',
        keys,
        statuses: [...entries.values()].filter((note) => keys.includes(note.key)),
      });
    },
    discard(key: string): void {
      const note = entries.get(key);
      if (!note || (note.phase !== 'sending' && note.phase !== 'retrying')) return;
      entries.set(key, { ...note, phase: 'discarded', delivery: [] });
      world.remove(note.id);
      resync();
    },
    finish(
      key: string | undefined,
      id: string,
      outcome: 'unanswered' | 'refused' | 'normal',
      delivery: readonly Delivery[],
    ): boolean {
      if (!key) return true;
      if (entries.get(key)?.phase === 'discarded') return false;
      const phase =
        outcome === 'unanswered' ? 'retrying' : outcome === 'refused' ? 'refused' : 'sent';
      entries.set(key, { key, id, phase, attempts: 1, delivery: [...delivery] });
      return true;
    },
  };
}
