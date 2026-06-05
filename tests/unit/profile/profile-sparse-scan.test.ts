import { describe, expect, it } from 'vitest';
import { continueSparseProfileScan } from '../../../src/lib/profile/profile-runtime-sparse';
import {
  emptyProfileState,
  type ProfileState,
} from '../../../src/lib/profile/profile-state';

describe('profile sparse scan', () => {
  it('continues bounded older scans while no posts are proven', async () => {
    let calls = 0;
    let state: ProfileState = { ...emptyProfileState(), loading: false };

    await continueSparseProfileScan({
      active: () => true,
      getState: () => state,
      loadOlder: async () => {
        calls++;
        state = calls < 3 ? state : { ...state, posts: [feedEvent('a')] };
      },
      maxAttempts: 4,
    });

    expect(calls).toBe(3);
  });

  it('stops on closed generation or exhausted history', async () => {
    let calls = 0;
    await continueSparseProfileScan({
      active: () => false,
      getState: () => ({ ...emptyProfileState(), loading: false }),
      loadOlder: async () => {
        calls++;
      },
    });
    expect(calls).toBe(0);

    await continueSparseProfileScan({
      active: () => true,
      getState: () => ({
        ...emptyProfileState(),
        loading: false,
        hasOlder: false,
      }),
      loadOlder: async () => {
        calls++;
      },
    });
    expect(calls).toBe(0);
  });
});

function feedEvent(id: string): ProfileState['posts'][number] {
  return {
    event: {
      id: id.repeat(64).slice(0, 64),
      pubkey: '2'.repeat(64),
      sig: '3'.repeat(128),
      kind: 1,
      tags: [],
      created_at: 1,
      content: '',
    },
    relays: [],
  };
}
