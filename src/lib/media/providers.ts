export type MediaUploadProvider =
  | 'disabled'
  | 'blossom'
  | 'nostr-build'
  | 'nostrcheck'
  | 'void-cat'
  | 'custom';

export type MediaUploadProtocol = 'none' | 'blossom' | 'nip96';

export type MediaUploadProviderConfig = {
  readonly id: MediaUploadProvider;
  readonly label: string;
  readonly server: string;
  readonly protocol: MediaUploadProtocol;
};

export const defaultMediaUploadProvider = 'blossom';

export const mediaUploadProviders: readonly MediaUploadProviderConfig[] = [
  { id: 'disabled', label: 'Disabled', server: '', protocol: 'none' },
  {
    id: 'blossom',
    label: 'Blossom custom server',
    server: '',
    protocol: 'blossom',
  },
  {
    id: 'nostr-build',
    label: 'nostr.build NIP-96',
    server: 'https://nostr.build',
    protocol: 'nip96',
  },
  {
    id: 'nostrcheck',
    label: 'Nostrcheck NIP-96',
    server: 'https://nostrcheck.me',
    protocol: 'nip96',
  },
  {
    id: 'void-cat',
    label: 'void.cat NIP-96',
    server: 'https://void.cat',
    protocol: 'nip96',
  },
  { id: 'custom', label: 'Custom NIP-96', server: '', protocol: 'nip96' },
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

export function providerProtocol(
  provider: MediaUploadProvider,
): MediaUploadProtocol {
  return configFor(provider).protocol;
}

export function providerServer(
  provider: MediaUploadProvider,
  customServer: string,
): string {
  if (usesCustomServer(provider)) return customServer.trim();
  return configFor(provider).server;
}

export function usesCustomServer(provider: MediaUploadProvider): boolean {
  return provider === 'blossom' || provider === 'custom';
}

export function validCustomUploadServer(value: string): boolean {
  if (!value.trim()) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function configFor(provider: MediaUploadProvider): MediaUploadProviderConfig {
  return (
    mediaUploadProviders.find((item) => item.id === provider) ??
    mediaUploadProviders[1]!
  );
}
