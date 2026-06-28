import {
  hasWasmMagic,
  parseAssetManifest,
  sha256,
  WASM_ASSET_DIR_NAME,
  WASM_MANIFEST_NAME,
  type WasmManifestAsset,
} from './wasm-assets';

export type HostedSmokeOptions = {
  readonly origin: string;
  readonly fetchImpl?: typeof fetch;
  readonly requireNoCacheManifest?: boolean;
};

export async function runHostedSmoke(
  options: HostedSmokeOptions,
): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const origin = normalizedOrigin(options.origin);
  await assertRoot(fetchImpl, origin);
  const manifestResponse = await fetchRequired(
    fetchImpl,
    origin,
    `/${WASM_ASSET_DIR_NAME}/${WASM_MANIFEST_NAME}`,
  );
  assertContentType(manifestResponse, 'application/json', 'manifest');
  if (options.requireNoCacheManifest ?? true) {
    assertNoCache(manifestResponse, 'manifest');
  }
  const manifestText = await manifestResponse.text();
  const manifest = parseAssetManifest(manifestText, origin);
  assertManifestAsset(
    manifest.script,
    'script',
    /^lkjstr_web-[a-f0-9]{16}\.js$/,
  );
  assertManifestAsset(
    manifest.wasm,
    'wasm',
    /^lkjstr_web_bg-[a-f0-9]{16}\.wasm$/,
  );
  await assertScript(fetchImpl, origin, manifest.script);
  await assertWasm(fetchImpl, origin, manifest.wasm);
  await assertMissingBridgeAsset(fetchImpl, origin);
}

async function assertRoot(fetchImpl: typeof fetch, origin: URL): Promise<void> {
  const response = await fetchRequired(fetchImpl, origin, '/');
  assertContentType(response, 'text/html', 'root');
  const html = await response.text();
  if (/<h1>500<\/h1>\s*<p>Internal Error<\/p>/i.test(html)) {
    throw new Error('root returned the SvelteKit 500 page');
  }
  if (/spawnSync wasm-pack|wasm-pack unavailable/i.test(html)) {
    throw new Error('root exposed raw Rust/WASM toolchain text');
  }
  if (
    !html.includes('_app/immutable/entry') &&
    !html.includes('workspace-shell')
  ) {
    throw new Error('root HTML is missing the browser app shell entry');
  }
}

async function assertScript(
  fetchImpl: typeof fetch,
  origin: URL,
  asset: WasmManifestAsset,
): Promise<void> {
  const response = await fetchRequired(fetchImpl, origin, asset.path);
  assertAnyContentType(response, ['javascript'], 'JavaScript bridge');
  const bytes = new Uint8Array(await response.arrayBuffer());
  assertAssetBytes(bytes, asset, 'JavaScript bridge');
  const source = new TextDecoder().decode(bytes);
  if (!source.includes('wasm') || !/export\s+default|__wbg_init/.test(source)) {
    throw new Error('JavaScript bridge is not a wasm-bindgen module');
  }
}

async function assertWasm(
  fetchImpl: typeof fetch,
  origin: URL,
  asset: WasmManifestAsset,
): Promise<void> {
  const response = await fetchRequired(fetchImpl, origin, asset.path);
  assertContentType(response, 'application/wasm', 'WASM binary');
  const bytes = new Uint8Array(await response.arrayBuffer());
  assertAssetBytes(bytes, asset, 'WASM binary');
  if (!hasWasmMagic(bytes))
    throw new Error('WASM binary has invalid magic bytes');
}

async function assertMissingBridgeAsset(
  fetchImpl: typeof fetch,
  origin: URL,
): Promise<void> {
  const response = await fetchImpl(
    new URL(`/${WASM_ASSET_DIR_NAME}/__missing__.wasm`, origin),
  );
  if (response.ok) {
    throw new Error('missing bridge asset returned a successful response');
  }
}

function assertManifestAsset(
  asset: WasmManifestAsset,
  label: string,
  namePattern: RegExp,
): void {
  if (!namePattern.test(asset.name)) {
    throw new Error(`${label} asset is not content-addressed`);
  }
  const expectedPath = `/${WASM_ASSET_DIR_NAME}/${asset.name}`;
  if (asset.path !== expectedPath) {
    throw new Error(`${label} asset path does not match its name`);
  }
}

function assertAssetBytes(
  bytes: Uint8Array,
  asset: WasmManifestAsset,
  label: string,
): void {
  if (bytes.length !== asset.bytes) {
    throw new Error(`${label} byte size does not match manifest`);
  }
  if (sha256(bytes) !== asset.sha256) {
    throw new Error(`${label} digest does not match manifest`);
  }
}

async function fetchRequired(
  fetchImpl: typeof fetch,
  origin: URL,
  pathname: string,
): Promise<Response> {
  const response = await fetchImpl(new URL(pathname, origin));
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}`);
  return response;
}

function assertContentType(
  response: Response,
  expected: string,
  label: string,
): void {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes(expected)) {
    throw new Error(`${label} content type was ${contentType || 'missing'}`);
  }
}

function assertAnyContentType(
  response: Response,
  expected: readonly string[],
  label: string,
): void {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!expected.some((value) => contentType.includes(value))) {
    throw new Error(`${label} content type was ${contentType || 'missing'}`);
  }
}

function assertNoCache(response: Response, label: string): void {
  const cacheControl = response.headers.get('cache-control') ?? '';
  if (!/\bno-cache\b/i.test(cacheControl)) {
    throw new Error(`${label} Cache-Control must include no-cache`);
  }
}

function normalizedOrigin(origin: string): URL {
  const url = new URL(origin);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url;
}
