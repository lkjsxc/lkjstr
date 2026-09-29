import cloudflare from '@sveltejs/adapter-cloudflare';
import staticAdapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const target = process.env.LKJSTR_ADAPTER ?? 'cloudflare';
if (!['cloudflare', 'static'].includes(target)) {
  throw new Error(`Unsupported LKJSTR_ADAPTER: ${target}`);
}

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter:
      target === 'static'
        ? staticAdapter({
            pages: 'build',
            assets: 'build',
            fallback: 'index.html',
            precompress: true,
          })
        : cloudflare({ platformProxy: { persist: false } }),
  },
};

export default config;
