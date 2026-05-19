import { describe, expect, it } from 'vitest';
import { contentAttachments } from '../../../src/lib/events/content-media';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('content media parsing', () => {
  it('classifies direct media urls, normal links, and imeta urls', () => {
    const attachments = contentAttachments(
      event(
        'https://example.com/a.jpg https://example.com/v.mp4 https://example.com/p',
        [['imeta', 'url https://example.com/audio.ogg', 'm audio/ogg']],
      ),
    );

    expect(attachments).toEqual([
      { url: 'https://example.com/audio.ogg', type: 'audio' },
      { url: 'https://example.com/a.jpg', type: 'image' },
      { url: 'https://example.com/v.mp4', type: 'video' },
      { url: 'https://example.com/p', type: 'link' },
    ]);
  });

  it('ignores invalid and non-https imeta urls', () => {
    expect(
      contentAttachments(
        event('http://example.com/a.jpg ftp://example.com/a.mp3', [
          ['imeta', 'url http://example.com/a.jpg', 'm image/jpeg'],
        ]),
      ),
    ).toEqual([]);
  });
});

function event(content: string, tags: string[][] = []): NostrEvent {
  return {
    id: 'a'.repeat(64),
    pubkey: 'b'.repeat(64),
    created_at: 1,
    kind: 1,
    tags,
    content,
    sig: 'c'.repeat(128),
  };
}
