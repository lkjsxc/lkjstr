# Feed LOD

## Purpose

This directory owns pure feed level-of-detail tree reducers for materialization,
forgetting, scoring, and recovery recipes.

## Table of Contents

- `mod.rs`: public module exports.
- `node.rs`: row, node, level, and tree building types.
- `score.rs`: pure retention scoring.
- `materialization.rs`: visible-range materialization planning.
- `recovery.rs`: recovery recipe lookup.
- `reducer.rs`: forgetting plan reducer.
