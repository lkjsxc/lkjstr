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

  it('keeps quiet verification focused on unit and build gates', () => {
    expect(packageJson.scripts['test:quiet']).toBe(
      'tsx scripts/run-quiet.ts test',
    );
    expect(packageJson.scripts['verify:quiet']).toBe(
      'tsx scripts/run-quiet.ts verify',
    );
    expect(packageJson.scripts['ci:quiet']).toBe('tsx scripts/run-quiet.ts ci');
    const removedFlowName = ['e', '2', 'e'].join('');
    expect(
      Object.keys(packageJson.scripts).some((key) =>
        key.includes(removedFlowName),
      ),
    ).toBe(false);
  });

  it('exposes Cloudflare dry-run verification without a publish script', () => {
    expect(packageJson.scripts['cloudflare:dry-run']).toBe(
      'pnpm build && wrangler deploy --dry-run',
    );
    expect(Object.hasOwn(packageJson.scripts, 'deploy')).toBe(false);
  });
});
