import { describe, expect, it } from 'vitest';
import { planEmojifiedText } from '../../../src/lib/components/events/emojified-text-plan';

describe('emojified text plan', () => {
  it('keeps retained text token keys stable while rendering matching emoji', () => {
    expect(
      planEmojifiedText('Hi :party: and :missing:', [
        {
          shortcode: 'party',
          url: 'https://emoji.example/party.png',
          address: `30030:${'a'.repeat(64)}:party`,
        },
      ]),
    ).toEqual([
      { key: '0:text', token: { type: 'text', text: 'Hi ' } },
      {
        key: '1:custom-emoji',
        token: {
          type: 'custom-emoji',
          shortcode: 'party',
          url: 'https://emoji.example/party.png',
          address: `30030:${'a'.repeat(64)}:party`,
          text: ':party:',
        },
      },
      {
        key: '2:text',
        token: { type: 'text', text: ' and :missing:' },
      },
    ]);
  });

  it('leaves URL tokens as visible text for retained inline labels', () => {
    expect(planEmojifiedText('See https://example.com/page')).toEqual([
      { key: '0:text', token: { type: 'text', text: 'See ' } },
      {
        key: '1:url',
        token: {
          type: 'url',
          url: 'https://example.com/page',
          text: 'https://example.com/page',
        },
      },
    ]);
  });
});
