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
  readonly preferred: PopoverPlacement;
  readonly gap: number;
}): PopoverPosition {
  const margin = 8;
  const placement = flip(args);
  const top = placement.startsWith('top')
    ? args.anchor.top - args.popover.height - args.gap
    : args.anchor.bottom + args.gap;
  const left = placement.endsWith('end')
    ? args.anchor.right - args.popover.width
    : args.anchor.left;
  return {
    top: clamp(
      top,
      margin,
      args.viewport.height - args.popover.height - margin,
    ),
    left: clamp(
      left,
      margin,
      args.viewport.width - args.popover.width - margin,
    ),
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
