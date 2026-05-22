import { describe, expect, it } from 'vitest';
import {
  customEmojiTokenText,
  customEmojiTag,
  parseCustomEmojiInput,
  validCustomEmojiAddress,
  validCustomEmojiShortcode,
  validCustomEmojiUrl,
} from '../../../src/lib/protocol';

describe('NIP-30 helpers', () => {
  it('parses HTTPS custom emoji input', () => {
    expect(parseCustomEmojiInput(':party:https://x/party.png')).toEqual({
      shortcode: 'party',
      url: 'https://x/party.png',
    });
    expect(parseCustomEmojiInput(':party:http://x/party.png')).toBeUndefined();
    expect(parseCustomEmojiInput(':bad code:https://x/p.png')).toBeUndefined();
  });

  it('validates shortcode and URL fields', () => {
    expect(validCustomEmojiShortcode('party_1')).toBe(true);
    expect(validCustomEmojiShortcode('party-1')).toBe(false);
    expect(validCustomEmojiShortcode('party:1')).toBe(false);
    expect(validCustomEmojiUrl('https://x/p.png')).toBe(true);
    expect(validCustomEmojiUrl('data:image/png;base64,a')).toBe(false);
    expect(customEmojiTokenText('party')).toBe(':party:');
  });

  it('parses and preserves optional emoji set addresses', () => {
    const pubkey = 'a'.repeat(64);
    const address = `30030:${pubkey}:blobcats`;
    expect(validCustomEmojiAddress(address)).toBe(true);
    expect(
      customEmojiTag(['emoji', 'party', 'https://x/party.png', address]),
    ).toEqual({ shortcode: 'party', url: 'https://x/party.png', address });
    expect(
      customEmojiTag(['emoji', 'party', 'https://x/party.png', 'bad']),
    ).toEqual({ shortcode: 'party', url: 'https://x/party.png' });
  });
});
