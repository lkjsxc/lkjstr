# Operations

## Purpose

Operations docs define local verification, Docker verification, diagnostics,
data safety, and test ownership.

## Tree

```text
operations/
|-- README.md
|-- ci.md
|-- data-safety.md
|-- diagnostics.md
|-- docker.md
|-- readiness.md
|-- testing-ownership.md
`-- verification.md
```

## Documents

- [verification.md](verification.md): command gate.
- [docker.md](docker.md): built-image Compose workflow.
- [ci.md](ci.md): hosted gates and GHCR images.
- [testing-ownership.md](testing-ownership.md): unit and e2e ownership.
- [readiness.md](readiness.md): release readiness checks.
- [diagnostics.md](diagnostics.md): debugging guidance.
- [data-safety.md](data-safety.md): local data safety.
