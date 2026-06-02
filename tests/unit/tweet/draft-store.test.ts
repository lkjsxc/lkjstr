import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Tweet draft store', () => {
  afterEach(() => vi.resetModules());

  it('saves, loads, and clears drafts through repository fallback', async () => {
    const { clearTweetDraft, loadTweetDraft, saveTweetDraft } =
      await import('../../../src/lib/tweet/draft-store');

    await saveTweetDraft(
      'hello',
      'account-1',
      [],
      [],
      true,
      'warning',
      'tab:1',
    );
    await expect(loadTweetDraft('tab:1')).resolves.toMatchObject({
      id: 'tab:1',
      accountId: 'account-1',
      content: 'hello',
      sensitive: true,
      contentWarningReason: 'warning',
    });

    await clearTweetDraft('tab:1');
    await expect(loadTweetDraft('tab:1')).resolves.toBeUndefined();
  });
});
