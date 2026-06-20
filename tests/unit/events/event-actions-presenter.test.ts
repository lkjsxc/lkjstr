import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const eventActions = readFileSync(
  'src/lib/components/events/EventActions.svelte',
  'utf8',
);

describe('event actions presenter wiring', () => {
  it('derives retained labels, controls, panels, and emoji source from helpers', () => {
    expect(eventActions).toContain('const labels = eventActionLabels();');
    expect(eventActions).toContain('let controls = $derived(');
    expect(eventActions).toContain('planEventActionControls({');
    expect(eventActions).toContain('let panel = $derived(');
    expect(eventActions).toContain('planEventActionPanel({');
    expect(eventActions).toContain('let emojiSource = $derived(');
    expect(eventActions).toContain('planEventActionEmojiSource(');
    expect(eventActions).toContain('loadEventActionEmojiSource(emojiSource');
  });

  it('delegates retained publish lifecycle state to the run helper', () => {
    expect(eventActions).toContain('await runEventAction(action, {');
    expect(eventActions).toContain('getMode: () => mode');
    expect(eventActions).toContain('isDestroyed: () => destroyed');
    expect(eventActions).toContain('onSuccess: props.onSuccess');
    expect(eventActions).toContain('setBusy: (next) => (busy = next)');
    expect(eventActions).toContain('setMode: (next) => (mode = next)');
    expect(eventActions).toContain('setStatus: (next) => (status = next)');
  });

  it('routes retained action controls through real publish and presenter calls', () => {
    expect(eventActions).toContain('planUnicodeEventReaction(emoji)');
    expect(eventActions).toContain('planCustomEmojiEventReaction(emoji)');
    expect(eventActions).toContain('publishReaction(');
    expect(eventActions).toContain(
      'publishRepost(props.event, props.relaySets)',
    );
    expect(eventActions).toContain(
      'publishReply(props.event, props.relaySets, reply)',
    );
    expect(eventActions).toContain('<EventActionIconButton');
    expect(eventActions).toContain('<EmojiPaletteButton');
    expect(eventActions).toContain('<EventActionInlinePanel');
    expect(eventActions).toContain('{panel}');
  });
});
