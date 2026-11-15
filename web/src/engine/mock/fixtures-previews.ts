// Local test double only. No public requests or embed HTML.
import type { LinkPreview, Segment } from '../protocol.ts';
import { photo } from './art.ts';
export function previewFixtures(segments: readonly Segment[]): LinkPreview[] {
  return segments
    .filter((s): s is Extract<Segment, { k: 'link' }> => s.k === 'link')
    .slice(0, 2)
    .map(({ url }) => {
      const u = new URL(url);
      const kind = u.host === 'x.com' ? 'post' : u.host === 'unavailable.example' ? 'link' : 'page';
      return {
        source: url,
        url,
        siteName: u.host,
        kind,
        title:
          kind === 'post'
            ? 'Aoi (@aoi)'
            : kind === 'link'
              ? u.pathname
              : u.pathname.includes('japanese')
                ? '街の図書館で過ごす静かな午後'
                : 'A quieter place to read the news',
        description:
          kind === 'post'
            ? 'A small note about making room for reading.'
            : 'Notes, places and the people who keep them open.',
        imageUrl: u.pathname.includes('picture') ? photo(480, 352, 160) : undefined,
      };
    });
}
