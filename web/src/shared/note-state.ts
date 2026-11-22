import { loadViewState, saveViewSlice } from './view-state.ts';

export type NoteState = {
  unfolded?: boolean;
  warning?: boolean;
  shown?: boolean;
  media?: string[];
  audio?: Record<string, number>;
  quotes?: string[];
  replies?: number;
  chips?: boolean;
  genericDetails?: boolean;
};
type Saved = { reader: [string, NoteState][] };
export const NOTE_STATE_LIMIT = 3000; // per tab, oldest changed note dropped

export function readNoteState(instance: string, id: string): NoteState {
  return loadViewState<Saved>(instance).reader?.find(([key]) => key === id)?.[1] ?? {};
}
export function writeNoteState(instance: string, id: string, patch: Partial<NoteState>): void {
  const all = loadViewState<Saved>(instance).reader ?? [];
  const next = { ...all.find(([key]) => key === id)?.[1], ...patch };
  saveViewSlice(
    instance,
    'reader',
    [...all.filter(([key]) => key !== id), [id, next]].slice(-NOTE_STATE_LIMIT),
  );
}
