// Folding can remove a native scrollbar. Batch only when
// unchanged, in-flow avatar columns alone keep every native view overflowing.
export function stableNoteWidths(elements: readonly HTMLElement[]): boolean {
  const views = new Set(elements.map((el) => el.closest<HTMLElement>('.view:not(.has-time-rail)')));
  for (const view of views) {
    if (!view) continue;
    const height = view.getBoundingClientRect().height;
    if (!view.isConnected || !(height > 0)) return false;
    let floor = 0;
    for (const avatar of view.querySelectorAll<HTMLElement>(
      ':scope .list > .note > .nrow > .avb',
    )) {
      floor += avatar.getBoundingClientRect().height;
      if (floor > height + 1) break;
    }
    if (!(floor > height + 1)) return false;
  }
  return true;
}
