export function avatarColor(pubkey: string): string {
  const seed = pubkey.slice(0, 6) || '445566';
  return `#${seed.padEnd(6, '0')}`;
}

export function initials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  return cleaned
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
