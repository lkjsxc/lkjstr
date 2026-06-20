import { describe, expect, it } from 'vitest';
import type { EventActionMode } from '../../../src/lib/components/events/event-actions-plan';
import { runEventAction } from '../../../src/lib/components/events/event-actions-run-plan';

describe('event action run lifecycle', () => {
  it('applies retained success state and callback before settling busy state', async () => {
    const harness = createRunHarness('reply');

    await runEventAction(async () => ({ ok: true }), harness.callbacks);

    expect(harness.state()).toEqual({
      busy: false,
      calls: [
        'busy:true',
        'status:',
        'status:',
        'mode:none',
        'success',
        'busy:false',
      ],
      destroyed: false,
      mode: 'none',
      status: '',
    });
  });

  it('keeps the active panel open for failed retained actions', async () => {
    const harness = createRunHarness('zap');

    await runEventAction(
      async () => ({ ok: false, message: 'Relay denied.' }),
      harness.callbacks,
    );

    expect(harness.state()).toEqual({
      busy: false,
      calls: [
        'busy:true',
        'status:',
        'status:Relay denied.',
        'mode:zap',
        'busy:false',
      ],
      destroyed: false,
      mode: 'zap',
      status: 'Relay denied.',
    });
  });

  it('skips post-await writes after the component is destroyed', async () => {
    const harness = createRunHarness('reply');

    await runEventAction(async () => {
      harness.destroy();
      return { ok: true };
    }, harness.callbacks);

    expect(harness.state()).toEqual({
      busy: true,
      calls: ['busy:true', 'status:'],
      destroyed: true,
      mode: 'reply',
      status: '',
    });
  });
});

function createRunHarness(initialMode: EventActionMode) {
  let busy = false;
  let destroyed = false;
  let mode = initialMode;
  let status = 'previous';
  const calls: string[] = [];

  return {
    callbacks: {
      getMode: () => mode,
      isDestroyed: () => destroyed,
      onSuccess: () => calls.push('success'),
      setBusy: (next: boolean) => {
        busy = next;
        calls.push(`busy:${next}`);
      },
      setMode: (next: EventActionMode) => {
        mode = next;
        calls.push(`mode:${next}`);
      },
      setStatus: (next: string) => {
        status = next;
        calls.push(`status:${next}`);
      },
    },
    destroy: () => {
      destroyed = true;
    },
    state: () => ({
      busy,
      calls: [...calls],
      destroyed,
      mode,
      status,
    }),
  };
}
