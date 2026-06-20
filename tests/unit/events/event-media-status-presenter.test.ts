import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mediaAttachment = readFileSync(
  'src/lib/components/events/MediaAttachment.svelte',
  'utf8',
);
const customEmojiImage = readFileSync(
  'src/lib/components/events/CustomEmojiImage.svelte',
  'utf8',
);
const feedSurfaceStatus = readFileSync(
  'src/lib/components/events/FeedSurfaceStatus.svelte',
  'utf8',
);

describe('event media and status presenter wiring', () => {
  it('keeps retained media links and open buttons on media plans', () => {
    expect(mediaAttachment).toContain('openMediaAttachment(props.attachment');
    expect(mediaAttachment).toContain(
      'planMediaAttachmentLink(props.attachment)',
    );
    expect(mediaAttachment).toContain(
      'onclick={stopMediaAttachmentPropagation}',
    );
    expect(mediaAttachment).toContain('loading="lazy"');
    expect(mediaAttachment).toContain('decoding="async"');
    expect(mediaAttachment).toContain(
      'mediaAttachmentOpenAfterStop(event, open)',
    );
    expect(mediaAttachment).toContain(
      'mediaAttachmentOpenButtonLabel(props.attachment.type)',
    );
    expect(mediaAttachment).toContain('{#snippet openButton()}');
    expect(mediaAttachment.match(/\{@render openButton\(\)\}/g)).toHaveLength(
      2,
    );
  });

  it('keeps retained custom emoji images on safe planned attributes', () => {
    expect(customEmojiImage).toContain('planCustomEmojiImage(props.emoji)');
    expect(customEmojiImage).toContain('{#if failed}');
    expect(customEmojiImage).toContain('{plan.fallbackText}');
    expect(customEmojiImage).toContain('src={plan.src}');
    expect(customEmojiImage).toContain('alt={plan.alt}');
    expect(customEmojiImage).toContain('loading={plan.loading}');
    expect(customEmojiImage).toContain('decoding={plan.decoding}');
    expect(customEmojiImage).toContain('referrerpolicy={plan.referrerPolicy}');
    expect(customEmojiImage).toContain('onerror={() => (failed = true)}');
  });

  it('keeps retained feed surface status chrome on status plans', () => {
    expect(feedSurfaceStatus).toContain('planFeedSurfaceStatus({');
    expect(feedSurfaceStatus).toContain("{#if plan.kind === 'error'}");
    expect(feedSurfaceStatus).toContain('role={plan.role}');
    expect(feedSurfaceStatus).toContain("{:else if plan.kind === 'loading'}");
    expect(feedSurfaceStatus).toContain('aria-busy={plan.ariaBusy}');
    expect(feedSurfaceStatus).toContain("{:else if plan.kind === 'end'}");
    expect(feedSurfaceStatus).toContain('{plan.text}');
  });
});
