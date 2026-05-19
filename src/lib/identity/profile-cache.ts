import type { NostrEvent } from '../protocol';
import type { ProfileSummary } from './identity';

const profiles = new Map<string, ProfileSummary>();

export function getProfile(pubkey: string): ProfileSummary | undefined {
  return profiles.get(pubkey);
}

export function setProfile(profile: ProfileSummary): void {
  const existing = profiles.get(profile.pubkey);
  if (existing && existing.updatedAt > profile.updatedAt) return;
  profiles.set(profile.pubkey, profile);
}

export function clearProfileCacheForTests(): void {
  profiles.clear();
}

export function profileFromMetadataEvent(event: NostrEvent): ProfileSummary {
  const parsed = safeJson(event.content);
  return {
    pubkey: event.pubkey,
    displayName: stringValue(parsed.display_name),
    name: stringValue(parsed.name),
    nip05: stringValue(parsed.nip05),
    avatarUrl: stringValue(parsed.picture),
    about: stringValue(parsed.about),
    website: stringValue(parsed.website),
    updatedAt: event.created_at * 1000,
  };
}

function safeJson(content: string): Record<string, unknown> {
  try {
    const value = JSON.parse(content) as unknown;
    return typeof value === 'object' && value
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
