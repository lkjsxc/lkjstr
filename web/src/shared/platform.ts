// Key names as this device prints them: ⌘ ⌥ ⇧ only on Apple devices, Ctrl / Alt / Shift everywhere else.
export const isApple = (platform = globalThis.navigator?.platform ?? ''): boolean =>
  /Mac|iPhone|iPad|iPod/.test(platform);

/** `Mod` is the platform's command key: ⌘ on Apple devices, Ctrl elsewhere. */
export function keyLabel(combo: string, apple = isApple()): string {
  const parts = combo.split('+');
  if (!apple) return parts.map((p) => (p === 'Mod' ? 'Ctrl' : p)).join('+');
  const sym: Record<string, string> = { Mod: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Enter: '↩' };
  return parts.map((p) => sym[p] ?? p).join('');
}

/** Whether a key event is `combo` ("Alt+Shift+T", "Mod+K", "Escape"); letters and digits match the physical key. */
export function matches(e: KeyboardEvent, combo: string, apple = isApple()): boolean {
  const parts = combo.split('+');
  const key = parts.pop() ?? '';
  const want = new Set(parts.map((p) => (p === 'Mod' ? (apple ? 'Meta' : 'Ctrl') : p)));
  if (e.altKey !== want.has('Alt') || e.ctrlKey !== want.has('Ctrl')) return false;
  if (e.metaKey !== want.has('Meta')) return false;
  const named = key.length > 1;
  if (named || /^[^A-Za-z0-9]$/.test(key)) {
    const symbol: Record<string, string> = { ',': 'Comma', '.': 'Period', '/': 'Slash' };
    if (e.shiftKey !== want.has('Shift') && named) return false;
    return e.key === key || e.code === symbol[key];
  }
  if (e.shiftKey !== want.has('Shift')) return false;
  return e.code === (/\d/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`);
}
