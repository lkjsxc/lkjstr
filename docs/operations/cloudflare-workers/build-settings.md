# Cloudflare Build Settings

## Purpose

Define supported hosted deployment modes for the SvelteKit Cloudflare target and
strict Rust/WASM bridge assets.

## Preferred Mode: GitHub Actions

Deploy from GitHub Actions only after Docker final gates pass. Required secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The deploy job in `.github/workflows/ci.yml` is enabled on `main` only when the
repository variable `CLOUDFLARE_DEPLOY_ENABLED` is `true`. It depends on the
Docker final gate, then uses Node 24, pnpm 11.1.2, Rust stable,
`wasm32-unknown-unknown`, and `wasm-pack 0.15.0`, or deploys the exact artifact
built inside the pinned Docker path. A direct host setup uses:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm cloudflare:dry-run:built
pnpm exec wrangler deploy
```

Do not deploy from a host environment that has not built and verified the bridge
assets.

## Supported Mode: Workers Builds Dashboard

Workers Builds may use the default build command:

```sh
pnpm build
```

`pnpm build` runs the explicit bridge builder first. In the Workers Build home,
the builder bootstraps Rust stable, `wasm32-unknown-unknown`, and
`wasm-pack 0.15.0` if `wasm-pack` is absent, then fails before Vite if bootstrap
or bridge generation fails. The bridge dependency graph is pure Rust for the
hosted WASM build and must not require `clang`. Set
`LKJSTR_BOOTSTRAP_WASM_TOOLCHAIN=0` only when the build image already provides
the pinned Rust/WASM toolchain.

Deploy command:

```sh
pnpm exec wrangler deploy
```

Environment and build variables:

- NODE\_&#86;ERSION=24
- PNPM\_&#86;ERSION=11.1.2

## Hosted Checks

After deployment, verify the live bridge assets:

```sh
curl -I https://lkjstr.com/
curl -I https://lkjstr.com/lkjstr-web-wasm/asset-manifest.json
```

Fetch the manifest, then fetch the listed JavaScript and WASM assets. The WASM
response must begin with bytes `00 61 73 6d`.
