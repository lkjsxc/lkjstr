import { describe, expect, it } from 'vitest';
import type { CustomEmoji } from '../../../src/lib/protocol';
import { loadEventActionEmojiSource } from '../../../src/lib/components/events/event-actions-emoji-source';

describe('event action emoji source lifecycle', () => {
  it('loads retained account emoji and applies only the current request', async () => {
    const harness = createEmojiHarness();
    const emoji = customEmoji('party');

    await loadEventActionEmojiSource(source('pubkey'), {
      ...harness.callbacks,
      loadAccountEmojiSource: async (input) => {
        harness.calls.push(`load:${input.pubkey}:${input.relays[0]}`);
        return [emoji];
      },
    });

    expect(harness.calls).toEqual([
      'request:1',
      'load:pubkey:wss://relay.example',
      'current:1:true',
      'apply:party',
    ]);
    expect(harness.applied).toEqual([[emoji]]);
  });

  it('skips stale emoji loads when a newer request starts first', async () => {
    const harness = createEmojiHarness();
    const loads: Array<(emoji: readonly CustomEmoji[]) => void> = [];
    const callbacks = {
      ...harness.callbacks,
      loadAccountEmojiSource: () =>
        new Promise<readonly CustomEmoji[]>((resolve) => loads.push(resolve)),
    };

    const first = loadEventActionEmojiSource(source('pubkey'), callbacks);
    const second = loadEventActionEmojiSource(source('pubkey'), callbacks);
    loads[0]?.([customEmoji('old')]);
    await first;
    loads[1]?.([customEmoji('new')]);
    await second;

    expect(harness.applied).toEqual([[customEmoji('new')]]);
  });

  it('skips emoji application after the component is destroyed', async () => {
    const harness = createEmojiHarness();
    harness.destroy();

    await loadEventActionEmojiSource(source('pubkey'), {
      ...harness.callbacks,
      loadAccountEmojiSource: async () => [customEmoji('party')],
    });

    expect(harness.applied).toEqual([]);
  });
});

function createEmojiHarness() {
  let currentRequest = 0;
  let destroyed = false;
  const applied: CustomEmoji[][] = [];
  const calls: string[] = [];

  return {
    applied,
    calls,
    callbacks: {
      nextRequest: () => {
        currentRequest += 1;
        calls.push(`request:${currentRequest}`);
        return currentRequest;
      },
      isCurrent: (request: number) => {
        const current = !destroyed && request === currentRequest;
        calls.push(`current:${request}:${current}`);
        return current;
      },
      setCustomEmojis: (emoji: readonly CustomEmoji[]) => {
        applied.push([...emoji]);
        calls.push(`apply:${emoji.map((item) => item.shortcode).join(',')}`);
      },
    },
    destroy: () => {
      destroyed = true;
    },
  };
}

function source(pubkey: string) {
  return {
    key: `${pubkey}|wss://relay.example`,
    pubkey,
    relays: ['wss://relay.example'],
  };
}

function customEmoji(shortcode: string): CustomEmoji {
  return {
    shortcode,
    url: `https://emoji.example/${shortcode}.png`,
  };
}
