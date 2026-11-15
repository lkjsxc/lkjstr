import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { SERVER_CHOICES } from '../src/shared/media-servers.ts';

it('offers the same media defaults in Settings and the real engine, in order', () => {
  const rust = readFileSync('../crates/lkjstr-core/src/engine/feedback.rs', 'utf8');
  const defaults = rust.match(/pub const MEDIA_SERVERS:[^=]+=\s*\[([\s\S]*?)\];/)?.[1] ?? '';
  expect([...defaults.matchAll(/"(https:[^"]+)"/g)].map((match) => match[1])).toEqual(
    SERVER_CHOICES,
  );
});
