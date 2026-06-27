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

Workers Builds may deploy only if the dashboard build installs the pinned
Rust/WASM toolchain before `pnpm build`. Recommended build command:

```sh
corepack enable && corepack prepare pnpm@11.1.2 --activate && \
curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable && \
. "$HOME/.cargo/env" && \
rustup target add wasm32-unknown-unknown && \
cargo install wasm-pack@0.15.0 --locked && \
pnpm install --frozen-lockfile && \
pnpm build
```

Deploy command:

```sh
pnpm exec wrangler deploy
```

Environment and build variables:

- NODE\_&#86;ERSION=24
- PNPM\_&#86;ERSION=11.1.2
- `SKIP_DEPENDENCY_INSTALL=1` when the build command installs dependencies

## Hosted Checks

After deployment, verify the live bridge assets:

```sh
curl -I https://lkjstr.com/
curl -I https://lkjstr.com/lkjstr-web-wasm/asset-manifest.json
```

Fetch the manifest, then fetch the listed JavaScript and WASM assets. The WASM
response must begin with bytes `00 61 73 6d`.
