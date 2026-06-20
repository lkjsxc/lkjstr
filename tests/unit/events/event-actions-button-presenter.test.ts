import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const eventActions = readFileSync(
  'src/lib/components/events/EventActions.svelte',
  'utf8',
);
const iconButton = readFileSync(
  'src/lib/components/events/EventActionIconButton.svelte',
  'utf8',
);

describe('event action icon button presenter', () => {
  it('owns retained action-bar button accessibility and state chrome', () => {
    expect(iconButton).toContain('type="button"');
    expect(iconButton).toContain('class="icon-button"');
    expect(iconButton).toContain('class:active={props.active}');
    expect(iconButton).toContain('class:icon-button--pressed={props.pressed}');
    expect(iconButton).toContain('title={props.title}');
    expect(iconButton).toContain('disabled={props.disabled}');
    expect(iconButton).toContain('aria-pressed={props.ariaPressed}');
    expect(iconButton).toContain('onclick={props.onclick}');
    expect(iconButton).toContain('<span class="sr-only">{props.label}</span>');
  });

  it('keeps retained event actions on the shared icon button presenter', () => {
    expect(eventActions).toContain('EventActionIconButton');
    expect(eventActions.match(/<EventActionIconButton/g)?.length).toBe(4);
    expect(eventActions).not.toContain('class="icon-button"');
  });
});
