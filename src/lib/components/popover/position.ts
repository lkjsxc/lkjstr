export type PopoverPlacement =
  | 'bottom-end'
  | 'bottom-start'
  | 'top-end'
  | 'top-start';

export type PopoverPosition = {
  readonly top: number;
  readonly left: number;
  readonly placement: PopoverPlacement;
};

export function computeAnchoredPosition(args: {
  readonly anchor: DOMRect;
  readonly popover: { width: number; height: number };
  readonly viewport: { width: number; height: number };
  readonly bounds?: DOMRect;
  readonly preferred: PopoverPlacement;
  readonly gap: number;
}): PopoverPosition {
  const margin = 8;
  const bounds = args.bounds ?? {
    top: 0,
    left: 0,
    width: args.viewport.width,
    height: args.viewport.height,
  };
  const placement = flip({
    anchor: args.anchor,
    popover: args.popover,
    viewport: { height: bounds.height },
    preferred: args.preferred,
    gap: args.gap,
  });
  const top = placement.startsWith('top')
    ? args.anchor.top - args.popover.height - args.gap
    : args.anchor.bottom + args.gap;
  const left = placement.endsWith('end')
    ? args.anchor.right - args.popover.width
    : args.anchor.left;
  const maxTop = bounds.top + bounds.height - args.popover.height - margin;
  const maxLeft = bounds.left + bounds.width - args.popover.width - margin;
  return {
    top: clamp(top, bounds.top + margin, maxTop),
    left: clamp(left, bounds.left + margin, maxLeft),
    placement,
  };
}

function flip(args: {
  readonly anchor: DOMRect;
  readonly popover: { height: number };
  readonly viewport: { height: number };
  readonly preferred: PopoverPlacement;
  readonly gap: number;
}): PopoverPlacement {
  const bottomSpace = args.viewport.height - args.anchor.bottom - args.gap;
  const topSpace = args.anchor.top - args.gap;
  if (
    args.preferred.startsWith('bottom') &&
    bottomSpace < args.popover.height &&
    topSpace > bottomSpace
  ) {
    return args.preferred === 'bottom-end' ? 'top-end' : 'top-start';
  }
  return args.preferred;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
