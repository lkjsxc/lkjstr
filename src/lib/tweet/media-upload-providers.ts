export type TweetMediaUploadProvider =
  | 'disabled'
  | 'nostr-build'
  | 'nostrcheck'
  | 'void-cat'
  | 'custom';

export type TweetMediaUploadProviderConfig = {
  readonly id: TweetMediaUploadProvider;
  readonly label: string;
  readonly server: string;
};

export const tweetMediaUploadProviders: readonly TweetMediaUploadProviderConfig[] =
  [
    { id: 'disabled', label: 'Disabled', server: '' },
    {
      id: 'nostr-build',
      label: 'nostr.build',
      server: 'https://nostr.build',
    },
    {
      id: 'nostrcheck',
      label: 'Nostrcheck',
      server: 'https://nostrcheck.me',
    },
    { id: 'void-cat', label: 'void.cat', server: 'https://void.cat' },
    { id: 'custom', label: 'Custom', server: '' },
  ];

export function providerIds(): TweetMediaUploadProvider[] {
  return tweetMediaUploadProviders.map((provider) => provider.id);
}

export function isUploadProvider(
  value: unknown,
): value is TweetMediaUploadProvider {
  return providerIds().includes(value as TweetMediaUploadProvider);
}

export function providerServer(
  provider: TweetMediaUploadProvider,
  customServer: string,
): string {
  if (provider === 'custom') return customServer.trim();
  return (
    tweetMediaUploadProviders.find((item) => item.id === provider)?.server ?? ''
  );
}

export function validCustomUploadServer(value: string): boolean {
  if (!value.trim()) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
