# Deployment

## Purpose

Describe the isolated application service, not the host's infrastructure state.

`compose.yaml` runs a verified `LKJSTR_IMAGE` with a read-only filesystem,
unprivileged user, loopback port, bounded resources, and a Rust readiness probe.
The image is built using the root Dockerfile's `self-hosted` target.

See [self-hosting](../docs/operations/self-hosting.md). The existing private
management repository remains authoritative for Incus, DNS, routing, and TLS.
This directory does not provision those resources or prove public deployment.
