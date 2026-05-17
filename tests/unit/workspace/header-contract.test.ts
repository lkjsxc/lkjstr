import { describe, expect, it } from 'vitest';
import { appMetadata } from '../../../src/lib/app/metadata';

describe('app header contract', () => {
  it('exposes only the app name and build label model', () => {
    expect(appMetadata).toEqual({ name: 'lkjstr', buildLabel: 'dev' });
  });
});
