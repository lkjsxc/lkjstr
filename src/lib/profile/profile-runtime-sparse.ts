import type { ProfileState } from './profile-state';

export async function continueSparseProfileScan(input: {
  readonly active: () => boolean;
  readonly getState: () => ProfileState;
  readonly loadOlder: () => Promise<void>;
  readonly maxAttempts?: number;
}): Promise<void> {
  const maxAttempts = input.maxAttempts ?? 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const state = input.getState();
    if (!input.active() || state.posts.length > 0 || !state.hasOlder) return;
    await input.loadOlder();
  }
}
