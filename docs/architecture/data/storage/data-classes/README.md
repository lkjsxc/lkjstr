# Storage Data Classes

## Purpose

Data classes explain what each durable record means under ownership, retention,
Stats, and repair.

## Table of Contents

- [ownership-classes.md](ownership-classes.md): exact class definitions.
- [table-manifest.md](table-manifest.md): live table matrix.
- [feed-coverage-correctness.md](feed-coverage-correctness.md): coverage proof rules.
- [tab-snapshots.md](tab-snapshots.md): tab-state payload and cleanup.

## Contract

Every live table has one data class and one inventory group. Row-level dynamic
protection may make an otherwise compactable row temporarily ineligible for
eviction, but it does not change the table's class.

The Markdown table is explanatory. The executable manifest is authoritative and
repository checks compare the two.
