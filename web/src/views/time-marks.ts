// Pixel-based placement of the occupied periods (docs/interface-time.md C2).
import type { Span } from './time-ruler.ts';

export type Label = Span & { readonly centre: number; readonly major: boolean };
export type Dot = { readonly y: number; readonly size: 2 | 3; readonly tone: number };
export type MarkPlan = { labels: Label[]; dots: Dot[]; frontier: Span[] };

const HALF = 6;
const GAP = 14;
const DOT_GAP = 2;
const SNAP = 6;
// Leave room for the held scrub box (about 24px tall) and the 12px label.
const SCRUB_GAP = 20;
export const LENS_RADIUS = 48;

/** Place coarser periods first. A labelled period opens its next unit where the rail has room. */
export function planMarks(years: readonly Span[], height: number, wide: boolean): MarkPlan {
  const labels: Label[] = [];
  const dots: Dot[] = [];
  const frontier: Span[] = [];
  const bottom = height - HALF;
  const dot = (s: Span, size: Dot['size']): void => {
    if (dots.every((d) => Math.abs(d.y - s.y) >= (d.size + size) / 2 + DOT_GAP))
      dots.push({ y: s.y, size, tone: s.tone });
  };
  const place = (s: Span, major: boolean): boolean => {
    let centre = Math.min(bottom, s.y + HALF);
    if (!major) {
      // When a parent and its newest child begin together, the child can use the next free line.
      for (const l of labels) if (Math.abs(l.centre - centre) < GAP) centre = l.centre + GAP;
      if (centre > s.end - HALF) return false;
    }
    if (centre < HALF || centre > bottom || labels.some((l) => Math.abs(l.centre - centre) < GAP))
      return false;
    labels.push({ ...s, centre, major });
    labels.sort((a, b) => a.centre - b.centre);
    return true;
  };

  const oldest = years.at(-1);
  let layer: Span[] = [];
  for (const year of oldest ? [oldest, ...years.slice(0, -1)] : []) {
    dot(year, 3);
    if (place(year, true)) layer.push(year);
  }
  while (layer.length) {
    const next: Span[] = [];
    for (const parent of layer) {
      for (const span of parent.children) {
        dot(span, 2);
        // A month head shares its day text and boundary; a clock head can repeat too.
        // Keep the parent's tone and snap target, but still open the child's finer units.
        const repeatsParent = span.y === parent.y && span.text === parent.text;
        if (wide && !span.coarse && (repeatsParent || place(span, false))) next.push(span);
        else if (!span.coarse) frontier.push(span);
      }
    }
    layer = next;
  }
  frontier.sort((a, b) => a.y - b.y);
  return { labels, dots: dots.sort((a, b) => a.y - b.y), frontier };
}

/** The first unlabelled unit of each branch gets its own short column while a press is held. */
export function lensMarks(plan: MarkPlan, y: number, height: number): Label[] {
  const start = Math.max(HALF, y - LENS_RADIUS);
  const end = Math.min(height - HALF, y + LENS_RADIUS);
  const labels: Label[] = [];
  for (const span of plan.frontier) {
    const natural = Math.max(start, span.y + HALF);
    if (natural > end) break;
    const centre = Math.abs(natural - y) < SCRUB_GAP ? y + SCRUB_GAP : natural;
    if (span.end < start || centre > end) continue;
    if (labels.some((l) => Math.abs(l.centre - centre) < GAP)) continue;
    labels.push({ ...span, centre, major: false });
  }
  return labels;
}

/** The label a press at `y` snaps to, if one is near enough. */
export const snap = (labels: readonly Label[], y: number): Label | undefined =>
  labels.find((l) => Math.abs(l.centre - y) <= SNAP);
