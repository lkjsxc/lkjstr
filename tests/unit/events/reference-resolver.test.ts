import { beforeEach, describe, expect, it } from 'vitest';
import { clearEventRepositoryForTests } from '../../../src/lib/events/repository';
import {
  referenceCacheSizeForTests,
  resolveReferences,
} from '../../../src/lib/events/reference-resolver';

describe('reference resolver cache', () => {
  beforeEach(() => clearEventRepositoryForTests());

  it('bounds cached reference lookups', async () => {
    const references = Array.from({ length: 650 }, (_, index) => ({
      id: index.toString(16).padStart(64, '0'),
      kind: 'quote' as const,
    }));
    await resolveReferences({ references, relays: [], key: 'refs' });
    expect(referenceCacheSizeForTests()).toBeLessThanOrEqual(500);
  });
});
