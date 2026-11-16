// Icons: one family, inline SVG, 24px grid, drawn in the current colour.
import { svg } from './h.ts';

const PATHS = {
  search: ['M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15', 'M16 16l5 5'],
  reply: ['M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 20l1.3-5A8.4 8.4 0 1 1 21 11.5z'],
  repost: [
    'M17 2l4 4-4 4',
    'M3 11V9a3 3 0 0 1 3-3h15',
    'M7 22l-4-4 4-4',
    'M21 13v2a3 3 0 0 1-3 3H3',
  ],
  heart: [
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  ],
  zap: ['M13 2L3 14h8l-1 8 10-12h-8l1-8z'],
  bookmark: ['M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  image: ['M3 5h18v14H3z', 'M3 16l5-5 4 4 3-3 6 5', 'M8.5 9.5h.01'],
  pen: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  check: ['M5 12l5 5L20 7'],
  up: ['M12 19V5', 'M5 12l7-7 7 7'],
  left: ['M15 5l-7 7 7 7'],
  right: ['M9 5l7 7-7 7'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  link: [
    'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1',
    'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  ],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21a8 8 0 0 1 16 0'],
  smile: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M8.5 14.5a4.5 4.5 0 0 0 7 0',
    'M9 9.5h.01',
    'M15 9.5h.01',
  ],
  play: ['M8 5l11 7-11 7z'],
  filter: ['M4 5h16l-6 8v5l-4 2v-7z'],
  lock: ['M6 10h12v11H6z', 'M8 10V6a4 4 0 0 1 8 0v4'],
} as const;
export type IconName = keyof typeof PATHS;

export function icon(name: IconName): SVGElement {
  const dots = name === 'more';
  return svg(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': dots ? 3 : 1.75,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      class: `i i-${name}`,
    },
    ...PATHS[name].map((d) => svg('path', { d })),
  );
}
