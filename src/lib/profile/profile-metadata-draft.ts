export const profileUpdatedEvent = 'lkjstr-profile-updated';

export type ProfileMetadataDraft = {
  readonly banner: string;
  readonly picture: string;
  readonly display_name: string;
  readonly name: string;
  readonly nip05: string;
  readonly website: string;
  readonly lud16: string;
  readonly about: string;
};

export const profileMetadataKeys = [
  'banner',
  'picture',
  'display_name',
  'name',
  'nip05',
  'website',
  'lud16',
  'about',
] as const;

export function draftFromMetadata(
  metadata: Record<string, unknown>,
): ProfileMetadataDraft {
  return Object.fromEntries(
    profileMetadataKeys.map((key) => [key, stringValue(metadata[key])]),
  ) as ProfileMetadataDraft;
}

export function mergeProfileMetadataDraft(
  base: Record<string, unknown>,
  draft: ProfileMetadataDraft,
): Record<string, unknown> {
  const next = { ...base };
  for (const key of profileMetadataKeys) {
    const value = draft[key].trim();
    if (value) next[key] = value;
    else delete next[key];
  }
  if (typeof base.lud06 === 'string' && base.lud06.trim())
    next.lud06 = base.lud06;
  return next;
}

export function validateProfileMetadataDraft(
  draft: ProfileMetadataDraft,
): string | null {
  for (const key of ['banner', 'picture', 'website'] as const) {
    const value = draft[key].trim();
    if (value && !httpsUrl(value)) return `${key} must be an HTTPS URL.`;
  }
  const nip05 = draft.nip05.trim();
  if (nip05 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nip05))
    return 'NIP-05 must look like name@example.com.';
  const lud16 = draft.lud16.trim();
  if (lud16 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lud16))
    return 'Lightning address must look like name@example.com.';
  return null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function httpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
