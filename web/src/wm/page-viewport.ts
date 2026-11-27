const FIELD = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const TEXT_INPUT =
  'input:not([type="button"], [type="checkbox"], [type="color"], [type="file"], [type="hidden"], [type="image"], [type="radio"], [type="range"], [type="reset"], [type="submit"])';

function editsText(node: EventTarget | null): boolean {
  return (
    node instanceof HTMLElement &&
    (node.isContentEditable ||
      node.matches(`:is(${TEXT_INPUT}, textarea):not(:disabled, [readonly])`))
  );
}

/** Tiles scroll inside the page. When iOS moves the page to reveal a field, put it back after editing. */
export function keepPageInPlace(): () => void {
  const port = globalThis.visualViewport;
  const appleMobile =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const viewport = appleMobile && document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  let settled: ReturnType<typeof setTimeout> | undefined;
  let release: (() => void) | undefined;
  let editing: { width: number; height: number; keyboard: boolean } | undefined;
  let returnToTop = false;
  const size = (p: VisualViewport) => ({ width: p.width * p.scale, height: p.height * p.scale });

  function restoreScale() {
    if (!viewport || release) return;
    const content = viewport.content;
    // WebKit clamps the current scale when viewport limits change. Give it time to apply the clamp.
    const deadline = setTimeout(() => release?.(), 500);
    release = () => {
      clearTimeout(deadline);
      viewport.content = content;
      release = undefined;
    };
    viewport.content = `${content}, maximum-scale=1`;
  }

  function begin(event: Event) {
    if (!viewport || !port || !editsText(event.target)) return;
    release?.();
    returnToTop = false;
    if (!editing && Math.abs(port.scale - 1) <= 0.01) {
      editing = { ...size(port), keyboard: false };
    }
  }

  function gesture() {
    // A pinch belongs to the reader, including one started while typing.
    editing = undefined;
    returnToTop = false;
    release?.();
  }

  function settle() {
    if (editing && port) {
      const current = size(port);
      if (Math.abs(current.width - editing.width) > 1) {
        editing = undefined; // The pre-keyboard height belongs to the old orientation or window size.
      } else {
        // Measure in unzoomed pixels and leave room for Safari's bars to expand or collapse.
        editing.keyboard ||= editing.height - current.height >= 120;
      }
    }
    clearTimeout(settled);
    settled = setTimeout(() => {
      const field = document.activeElement;
      const scale = port?.scale ?? 1;
      if (scale <= 1.01) release?.();
      if (editing && port) {
        const closed = editing.keyboard && editing.height - size(port).height < 80;
        if (!editsText(field) || closed) {
          returnToTop ||= closed;
          if (scale > 1.01) restoreScale();
          if (closed || !editing.keyboard) editing = undefined;
        }
      }
      if (scale <= 1.01 && (returnToTop || !field?.matches(FIELD))) {
        returnToTop = false;
        if (scrollX || scrollY) scrollTo(0, 0);
      }
    }, 100);
  }

  document.addEventListener('focusin', begin);
  document.addEventListener('focusout', settle);
  document.addEventListener('pointerdown', begin);
  document.addEventListener('gesturestart', gesture);
  port?.addEventListener('resize', settle);
  return () => {
    clearTimeout(settled);
    release?.();
    document.removeEventListener('focusin', begin);
    document.removeEventListener('focusout', settle);
    document.removeEventListener('pointerdown', begin);
    document.removeEventListener('gesturestart', gesture);
    port?.removeEventListener('resize', settle);
  };
}
