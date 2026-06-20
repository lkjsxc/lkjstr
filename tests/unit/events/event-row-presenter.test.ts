import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const eventRow = readFileSync(
  'src/lib/components/events/EventRow.svelte',
  'utf8',
);
const fragmentRow = readFileSync(
  'src/lib/components/events/EventFragmentRow.svelte',
  'utf8',
);
const rowFrame = readFileSync(
  'src/lib/components/events/EventRowFrame.svelte',
  'utf8',
);
const rowAvatar = readFileSync(
  'src/lib/components/events/EventRowAvatar.svelte',
  'utf8',
);

describe('event row presenter wiring', () => {
  it('routes retained full and fragmented rows through shared helpers', () => {
    for (const source of [eventRow, fragmentRow]) {
      expect(source).toContain('planEventRowPresentation({');
      expect(source).toContain('createEventRowSuccessHighlighter(');
      expect(source).toContain('successHighlighter.destroy();');
      expect(source).toContain('openEventThreadFromRowClick(');
      expect(source).toContain('openEventThreadFromRowKey(');
      expect(source).toContain('successHighlighter.trigger();');
      expect(source).toContain('interactive={presentation.thread.openable}');
      expect(source).toContain('onRowClick={openRow}');
      expect(source).toContain('onRowKeydown={handleKeydown}');
      expect(source).toContain('presentation={presentation.profile}');
      expect(source).toContain('openProfile={props.openProfile}');
      expect(source).toContain('onSuccess={highlightAction}');
    }
  });

  it('keeps retained row frame chrome controlled by the presentation plan', () => {
    expect(rowFrame).toContain('{#if props.interactive}');
    expect(rowFrame).toContain('class="event-row event-row--interactive"');
    expect(rowFrame).toContain('role="button"');
    expect(rowFrame).toContain('tabindex="0"');
    expect(rowFrame).toContain('onclick={props.onRowClick}');
    expect(rowFrame).toContain('onkeydown={props.onRowKeydown}');
    expect(rowFrame).toContain('style={props.depthStyle}');
    expect(rowFrame).toContain(
      'class:event-row--action-success={props.highlighted}',
    );
  });

  it('renders row avatars as profile buttons only when planned openable', () => {
    expect(rowAvatar).toContain('stopAndOpenEventProfile(');
    expect(rowAvatar).toContain('{#if props.presentation.openable}');
    expect(rowAvatar).toContain('aria-label={props.presentation.label}');
    expect(rowAvatar).toContain('onclick={openProfile}');
    expect(rowAvatar).toContain('<span class="avatar-button">');
    expect(rowAvatar).toContain('{#snippet avatarBody()}');
    expect(rowAvatar).toContain('avatarOnly');
    expect(rowAvatar.match(/\{@render avatarBody\(\)\}/g)).toHaveLength(2);
  });
});
