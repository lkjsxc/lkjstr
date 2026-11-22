// The first ownership pass is synchronous so replacement nodes share an existing URL lease.
// IntersectionObserver supplies subsequent scroll/clipping updates.
type Clip = { rect: DOMRect; x: boolean; y: boolean };
export function visibleAvatars(root: HTMLElement): (el: HTMLElement) => boolean {
  const clips = new Map<HTMLElement, Clip>(); // Scratch, at most the current faces' ancestors.
  return (el) => {
    if (!el.isConnected || !root.contains(el) || !el.getClientRects().length) return false;
    if (getComputedStyle(el).visibility !== 'visible') return false;
    const rect = el.getBoundingClientRect();
    let left = Math.max(0, rect.left),
      right = Math.min(innerWidth, rect.right);
    let top = Math.max(0, rect.top),
      bottom = Math.min(innerHeight, rect.bottom);
    for (
      let node = el.parentElement;
      node && right > left && bottom > top;
      node = node.parentElement
    ) {
      let clip = clips.get(node);
      if (!clip) {
        const style = getComputedStyle(node);
        const border = node.getBoundingClientRect();
        const sx = node.offsetWidth ? border.width / node.offsetWidth : 1;
        const sy = node.offsetHeight ? border.height / node.offsetHeight : 1;
        clip = {
          // Overflow clips at the scrollport, excluding borders/scrollbars; preserve CSS zoom/scale.
          rect: new DOMRect(
            border.left + node.clientLeft * sx,
            border.top + node.clientTop * sy,
            node.clientWidth * sx,
            node.clientHeight * sy,
          ),
          x: /^(auto|scroll|hidden|clip)$/.test(style.overflowX),
          y: /^(auto|scroll|hidden|clip)$/.test(style.overflowY),
        };
        clips.set(node, clip);
      }
      if (clip.x) {
        left = Math.max(left, clip.rect.left);
        right = Math.min(right, clip.rect.right);
      }
      if (clip.y) {
        top = Math.max(top, clip.rect.top);
        bottom = Math.min(bottom, clip.rect.bottom);
      }
      if (node === root) break;
    }
    return right > left && bottom > top;
  };
}
