import { describe, expect, it } from 'vitest';
import { eventRowTargetIsLocal } from '../../../src/lib/components/events/event-row-local-target';

describe('event row local targets', () => {
  it('keeps retained row controls from opening the thread row', () => {
    const seenSelectors: string[] = [];
    const target = {
      closest(selector: string) {
        seenSelectors.push(selector);
        return selector.includes('.event-action-zone') ? {} : null;
      },
    } as unknown as EventTarget;

    expect(eventRowTargetIsLocal(target)).toBe(true);
    expect(seenSelectors).toEqual([
      'button,a,input,textarea,select,form,audio,video,.event-action-zone',
    ]);
  });

  it('treats native media controls as local row targets', () => {
    const target = {
      closest: (selector: string) => (selector.includes('video') ? {} : null),
    } as unknown as EventTarget;

    expect(eventRowTargetIsLocal(target)).toBe(true);
  });

  it('lets non-control row targets open the thread row', () => {
    const target = {
      closest: () => null,
    } as unknown as EventTarget;

    expect(eventRowTargetIsLocal(target)).toBe(false);
    expect(eventRowTargetIsLocal(null)).toBe(false);
  });

  it('treats text-node targets inside row controls as local', () => {
    const textTarget = {
      parentElement: {
        closest: (selector: string) =>
          selector.includes('button') ? {} : null,
      },
    } as unknown as EventTarget;

    expect(eventRowTargetIsLocal(textTarget)).toBe(true);
  });
});
