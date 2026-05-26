import { describe, expect, it } from 'vitest';
import { createPaneScrollRetention } from '../../../src/lib/workspace/pane-scroll-retention';

describe('pane scroll retention', () => {
  it('remembers and restores scrollTop including zero', () => {
    const retention = createPaneScrollRetention();
    const body = document.createElement('div');
    const scroller = document.createElement('div');
    scroller.setAttribute('data-scroll-owner', '');
    Object.defineProperty(scroller, 'scrollHeight', { value: 400 });
    Object.defineProperty(scroller, 'clientHeight', { value: 200 });
    scroller.scrollTop = 0;
    body.append(scroller);
    retention.track('tab-a', body);
    retention.remember('tab-a');
    expect(retention.snapshot('tab-a').scrollTop).toBe(0);
    scroller.scrollTop = 120;
    retention.remember('tab-a');
    retention.restoreSnapshot('tab-a', { scrollTop: 0 });
    retention.restore('tab-a');
    expect(scroller.scrollTop).toBe(0);
  });
});
