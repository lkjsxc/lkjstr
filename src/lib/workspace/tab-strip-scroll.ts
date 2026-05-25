export function stripFadeState(strip: HTMLElement | undefined): {
  left: boolean;
  right: boolean;
} {
  if (!strip) return { left: false, right: false };
  return {
    left: strip.scrollLeft > 4,
    right: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 4,
  };
}

export function revealTabInStrip(
  strip: HTMLElement | undefined,
  tabId: string,
): void {
  if (!strip) return;
  const frame = strip.querySelector<HTMLElement>(
    `.tab-frame[data-tab-id="${tabId}"]`,
  );
  frame?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
