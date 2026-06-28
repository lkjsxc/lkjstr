import { describe, expect, it } from 'vitest';
import { ssr } from '../../../src/routes/+page';

describe('root route rendering contract', () => {
  it('keeps the browser workspace out of Cloudflare Worker SSR', () => {
    expect(ssr).toBe(false);
  });
});
