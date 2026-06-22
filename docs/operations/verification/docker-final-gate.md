# Docker Final Gate

## Purpose

Docker compose final verification commands.

## Details

The Docker `verify` target runs `lkjstr-xtask quiet docker-verify`, which omits
production app build because the `app` target owns that artifact.

```sh
docker compose -f docker-compose.yml config
docker compose --progress quiet -f docker-compose.yml build app verify cloudflare app-smoke
docker compose --progress quiet -f docker-compose.yml run --rm verify
docker compose --progress quiet -f docker-compose.yml run --rm cloudflare
docker compose --progress quiet -f docker-compose.yml run --rm app-smoke
```

Focused change-area gates live in [focused-gates.md](../focused-gates.md). Run the
matching focused gate before the final Docker gate when a change touches that
area.
