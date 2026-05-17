import { describe, expect, it } from 'vitest';

describe('tooling smoke', () => {
  it('runs tests', () => {
    expect('lkjstr').toContain('str');
  });
});
