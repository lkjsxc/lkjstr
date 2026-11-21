import { expect, it } from 'vitest';
import { createSettings } from '../src/shared/settings.ts';
import { kv } from '../src/shared/storage.ts';

it('retains posting preferences per account and uses the old device choice as the fallback', () => {
  const a = 'a'.repeat(64);
  const b = 'b'.repeat(64);
  const settings = createSettings(a);
  try {
    expect(settings.get().clientTag).toBe(true);
    settings.patch({ clientTag: false });
    settings.setAccount(b);
    expect(settings.get().clientTag).toBe(true);
    settings.patch({ theme: 'dark' });
    settings.setAccount(a);
    expect(settings.get()).toMatchObject({ clientTag: false, theme: 'dark' });
    const reloaded = createSettings(a);
    expect(reloaded.get().clientTag).toBe(false);
    reloaded.dispose();

    kv.set('settings', { clientTag: false, theme: 'dark' });
    settings.setAccount(b);
    expect(settings.get().clientTag).toBe(false);
    settings.patch({ clientTag: true });
    settings.setAccount(a);
    expect(settings.get().clientTag).toBe(false);
    settings.setAccount(b);
    expect(settings.get().clientTag).toBe(true);
    expect(kv.get('settings')).toEqual({ clientTag: false, theme: 'dark' });
  } finally {
    settings.dispose();
    localStorage.clear();
  }
});
