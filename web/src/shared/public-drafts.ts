// Public add/edit forms in Settings keep unfinished text. Signing and backup fields never enter this path.
import { loadViewState, saveViewSlice } from './view-state.ts';
export function keepPublicDrafts(el: HTMLElement, instance: string): () => void {
  type State = { drafts?: Record<string, string> };
  const key = (field: HTMLElement): string | undefined => {
    const entry = field.closest<HTMLElement>('[data-entry]')?.dataset.entry;
    if (!entry || !field.matches('.addrow input')) return undefined;
    return entry;
  };
  const restore = (): void => {
    const state = loadViewState<State>(instance);
    for (const field of el.querySelectorAll<HTMLInputElement>('.addrow input')) {
      const k = key(field);
      if (k && state.drafts?.[k] !== undefined && document.activeElement !== field)
        field.value = state.drafts[k];
    }
  };
  const save = (e: Event): void => {
    const field = e.target as HTMLInputElement;
    const k = key(field);
    if (!k) return;
    const state = loadViewState<State>(instance);
    saveViewSlice(instance, 'drafts', { ...state.drafts, [k]: field.value });
  };
  const submitted = (e: Event): void => {
    const field = (e.target as Element).querySelector<HTMLInputElement>('input');
    if (field) queueMicrotask(() => save({ target: field } as unknown as Event));
  };
  el.addEventListener('input', save);
  el.addEventListener('submit', submitted);
  restore();
  return () => {
    el.removeEventListener('input', save);
    el.removeEventListener('submit', submitted);
  };
}
