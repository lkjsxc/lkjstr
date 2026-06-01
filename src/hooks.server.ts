import type { Handle } from '@sveltejs/kit';

const headers = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  for (const [key, value] of Object.entries(headers))
    response.headers.set(key, value);
  return response;
};
