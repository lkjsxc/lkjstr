import { describe, expect, it } from 'vitest';
import type { ContentAttachment } from '../../../src/lib/events/content-media';
import {
  mediaAttachmentOpenAfterStop,
  mediaAttachmentOpenButtonLabel,
  openMediaAttachment,
  planMediaAttachmentLink,
  planMediaAttachmentOpen,
  stopMediaAttachmentPropagation,
} from '../../../src/lib/components/events/media-attachment-plan';

describe('media attachment plan', () => {
  it('keeps external media opens isolated to a new noopener target', () => {
    const opened: string[] = [];
    expect(planMediaAttachmentOpen(attachment('video'))).toEqual({
      url: 'https://media.example/video',
      target: '_blank',
      features: 'noopener,noreferrer',
    });

    openMediaAttachment(attachment('video'), (url, target, features) => {
      opened.push(`${url}|${target}|${features}`);
    });
    expect(opened).toEqual([
      'https://media.example/video|_blank|noopener,noreferrer',
    ]);
  });

  it('keeps retained media anchors external and opener-safe', () => {
    expect(planMediaAttachmentLink(attachment('image'))).toEqual({
      href: 'https://media.example/image',
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  });

  it('preserves retained video and audio open labels', () => {
    expect(mediaAttachmentOpenButtonLabel('video')).toBe('Open video');
    expect(mediaAttachmentOpenButtonLabel('audio')).toBe('Open audio');
    expect(mediaAttachmentOpenButtonLabel('image')).toBe('Open media');
    expect(mediaAttachmentOpenButtonLabel('link')).toBe('Open media');
  });

  it('keeps retained media interactions from opening the parent row', () => {
    let stopped = 0;

    stopMediaAttachmentPropagation({
      stopPropagation: () => (stopped += 1),
    });

    expect(stopped).toBe(1);
  });

  it('stops propagation before opening retained media controls', () => {
    const calls: string[] = [];

    mediaAttachmentOpenAfterStop(
      { stopPropagation: () => calls.push('stop') },
      () => calls.push('open'),
    );

    expect(calls).toEqual(['stop', 'open']);
  });
});

function attachment(type: ContentAttachment['type']): ContentAttachment {
  return {
    type,
    url: `https://media.example/${type}`,
  };
}
