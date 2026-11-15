# Deployment

## Purpose

Describe the isolated application service, not the host's infrastructure state.

## Table of Contents

- [compose.yaml](compose.yaml): isolated application service and readiness probe.

## Runtime

`compose.yaml` runs a verified `LKJSTR_IMAGE` with a read-only filesystem,
unprivileged user, loopback port, bounded resources, and a Rust readiness probe.
The image is built using the root Dockerfile's `self-hosted` target.

See [status](../docs/status.md): the self-hosted image is not rebuilt yet. The existing private
management repository remains authoritative for Incus, DNS, routing, and TLS.
This directory does not provision those resources or prove public deployment.

## Optional previews

The Dockerfile also has an independent `preview` target containing
lkjstr-preview. It requires a writable bounded cache directory and loopback
routing for /preview and /preview/health. The main app target remains static;
the preview target is not deployed by compose.yaml. The actual site's edge
and release lifecycle belong to the management repository. See
[hosting needs](../docs/hosting-needs.md) and the task handoff in tmp/preview-deploy.md.
