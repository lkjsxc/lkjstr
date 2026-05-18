# Docker

## Purpose

Docker docs define the Compose verification path.

## Contract

- Compose services build images from `Dockerfile`.
- Services do not mount the source tree.
- `app` runs the dev server from the built image.
- `verify` runs `pnpm verify` from the built image.
- `e2e` installs Playwright browser dependencies in its image.

## Commands

```sh
docker compose config
docker compose build app verify e2e
docker compose run --rm verify
docker compose run --rm e2e
```
