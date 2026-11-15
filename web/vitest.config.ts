import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __VERSION__: '"test"', __COMMIT__: '"test"', __ENGINE_URL__: '""' },
  test: { maxWorkers: 4, environment: 'happy-dom', include: ['tests/**/*.test.ts'] },
});
