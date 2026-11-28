// Geometry is authoritative; queued observer entries can describe an older layout.
export const AVATAR_MARGIN = 192; // The least "next rows" distance; the owner widens it to one screen.
type Clip = { rect: DOMRect; x: boolean; y: boolean; scroll: boolean };
export function visibleAvatars(root: HTMLElement, margin = 0): (el: HTMLElement) => boolean {
  const clips = new Map<HTMLElement, Clip>(); // Scratch, at most the current faces' ancestors.
  return (el) => {
    if (!el.isConnected || !root.contains(el) || !el.getClientRects().length) return false;
    const rect = el.getBoundingClientRect();
    // Most retained feed rows are far away; skip ancestor/style reads until they approach this frame.
    if (
      rect.right <= 0 ||
      rect.left >= innerWidth ||
      rect.bottom <= -margin ||
      rect.top >= innerHeight + margin ||
      rect.width <= 0 ||
      rect.height <= 0
    )
      return false;
    if (getComputedStyle(el).visibility !== 'visible') return false;
    let left = Math.max(0, rect.left),
      right = Math.min(innerWidth, rect.right);
    let top = rect.top,
      bottom = rect.bottom,
      portTop = 0,
      portBottom = innerHeight;
    let scroll = false;
    for (
      let node = el.parentElement;
      node && right > left && bottom > top;
      node = node.parentElement
    ) {
      let clip = clips.get(node);
      if (!clip) {
        const style = getComputedStyle(node),
          border = node.getBoundingClientRect();
        const sx = node.offsetWidth ? border.width / node.offsetWidth : 1;
        const sy = node.offsetHeight ? border.height / node.offsetHeight : 1;
        clip = {
          // Exclude borders/scrollbars and preserve CSS zoom/scale.
          rect: new DOMRect(
            border.left + node.clientLeft * sx,
            border.top + node.clientTop * sy,
            node.clientWidth * sx,
            node.clientHeight * sy,
          ),
          x: /^(auto|scroll|hidden|clip)$/.test(style.overflowX),
          y: /^(auto|scroll|hidden|clip)$/.test(style.overflowY),
          scroll: /^(auto|scroll)$/.test(style.overflowY),
        };
        clips.set(node, clip);
      }
      if (clip.x) {
        left = Math.max(left, clip.rect.left);
        right = Math.min(right, clip.rect.right);
      }
      scroll ||= clip.scroll;
      if (clip.y) {
        if (scroll) {
          // Form the real scrollport first, including its outer paint/overflow clip.
          // Expanding only the inner scroller would leave .body.own clipping the warm region away.
          portTop = Math.max(portTop, clip.rect.top);
          portBottom = Math.min(portBottom, clip.rect.bottom);
        } else {
          // Local masks/folds inside the scroller remain strict, even while warming.
          top = Math.max(top, clip.rect.top);
          bottom = Math.min(bottom, clip.rect.bottom);
        }
      }
      if (node === root) break;
    }
    return (
      right > left &&
      bottom > top &&
      portBottom > portTop &&
      bottom > portTop - margin &&
      top < portBottom + margin
    );
  };
}
