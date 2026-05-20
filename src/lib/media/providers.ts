export type MediaUploadProvider =
  | 'disabled'
  | 'nostr-build'
  | 'nostrcheck'
  | 'void-cat'
  | 'custom';

export type MediaUploadProviderConfig = {
  readonly id: MediaUploadProvider;
  readonly label: string;
  readonly server: string;
};

export const defaultMediaUploadProvider = 'nostr-build';

export const mediaUploadProviders: readonly MediaUploadProviderConfig[] = [
  { id: 'disabled', label: 'Disabled', server: '' },
  { id: 'nostr-build', label: 'nostr.build', server: 'https://nostr.build' },
  { id: 'nostrcheck', label: 'Nostrcheck', server: 'https://nostrcheck.me' },
  { id: 'void-cat', label: 'void.cat', server: 'https://void.cat' },
  { id: 'custom', label: 'Custom', server: '' },
];

export function providerIds(): MediaUploadProvider[] {
  return mediaUploadProviders.map((provider) => provider.id);
}

export function isUploadProvider(value: unknown): value is MediaUploadProvider {
  return providerIds().includes(value as MediaUploadProvider);
}

export function cleanUploadProvider(value: unknown): MediaUploadProvider {
  return isUploadProvider(value) ? value : defaultMediaUploadProvider;
}

export function providerServer(
  provider: MediaUploadProvider,
  customServer: string,
): string {
  if (provider === 'custom') return customServer.trim();
  return (
    mediaUploadProviders.find((item) => item.id === provider)?.server ?? ''
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
