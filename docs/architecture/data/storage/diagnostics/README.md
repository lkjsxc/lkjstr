# Storage Diagnostics

## Purpose

Storage diagnostics explain what browser storage contains, why pressure remains,
and which verification proves storage behavior.

## Table of Contents

- [inventory.md](inventory.md): IndexedDB and browser storage inventory.
- [pressure-states.md](pressure-states.md): cache pressure labels.
- [stats.md](stats.md): Stats UI projection.
- [verification.md](verification.md): required checks.

## Contract

Diagnostics may be partial, but they must be explicit. A timeout, unavailable
store, unsupported API, or incomplete inventory is reported as such. Partial
byte counts are useful only when paired with status and reason. Unknown legacy
or unowned storage is a visible inventory class. Only the remaining positive
gap after enumeration is residual browser overhead.
