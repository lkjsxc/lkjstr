import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json' with { type: 'json' };

describe('package scripts', () => {
  it('syncs generated SvelteKit config before lint and check tools run', () => {
    expect(packageJson.scripts['kit:sync']).toBe('svelte-kit sync');
    expect(packageJson.scripts.lint.startsWith('pnpm kit:sync && ')).toBe(true);
    expect(packageJson.scripts.check.startsWith('pnpm kit:sync && ')).toBe(
      true,
    );
    expect(packageJson.scripts.check).toContain('svelte-check');
    expect(packageJson.scripts.lint).toContain('eslint');
  });

  it('exposes focused memory browser smoke coverage', () => {
    expect(packageJson.scripts['test:e2e:memory']).toContain(
      'playwright test tests/e2e/memory-gate.spec.ts',
    );
  });

  it('exposes Cloudflare dry-run verification without a publish script', () => {
    expect(packageJson.scripts['cloudflare:dry-run']).toBe(
      'pnpm build && wrangler deploy --dry-run',
    );
    expect(Object.hasOwn(packageJson.scripts, 'deploy')).toBe(false);
  });
});
