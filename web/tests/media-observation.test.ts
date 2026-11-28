import { expect, it, vi } from 'vitest';
import { beginImageObservation, observeImages } from '../src/shared/media-observation.ts';
import { loadImage } from '../src/shared/media-source.ts';

const context = { class: 'media', slot: 'note-image', lane: 'L1', view: 'test-view' } as const;

it('observes only explicit public effects, once, with the declared display size', () => {
  const receive = vi.fn();
  const stop = observeImages(receive);
  try {
    const image = document.createElement('img');
    image.width = 80;
    image.height = 40;
    beginImageObservation(image, 'https://image.test/private', undefined)('ok');
    beginImageObservation(image, 'blob:private', context)('ok');
    const end = beginImageObservation(image, 'https://image.test/public', context);
    end('ok');
    end('cancelled');
    expect(receive).toHaveBeenCalledTimes(1);
    expect(receive).toHaveBeenCalledWith(
      expect.objectContaining({ ...context, outcome: 'ok', displaySize: [80, 40] }),
    );
  } finally {
    stop();
  }
});

it('preserves native load and failure behavior when observation throws', () => {
  const receive = vi.fn(() => {
    throw new Error('stopped observer');
  });
  const stop = observeImages(receive);
  try {
    const image = document.createElement('img');
    const failure = vi.fn();
    const cancel = loadImage(
      image,
      'https://images.test/r0-observation.png',
      failure,
      undefined,
      context,
    );
    image.dispatchEvent(new Event('load'));
    cancel();
    expect(failure).not.toHaveBeenCalled();
    expect(receive).toHaveBeenCalledTimes(1);
  } finally {
    stop();
  }
});
