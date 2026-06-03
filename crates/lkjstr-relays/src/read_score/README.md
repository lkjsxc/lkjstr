# Relay Read Score

## Purpose

This module owns pure relay read scoring for real observations. It contains no
browser objects, no storage effects, and no relay I/O. Product runtimes pass
serializable observations in and receive bounded scores and ordering output.

## Table of Contents

- `key.rs`: stable request-context keys and filter-shape normalization.
- `observation.rs`: real read observation input.
- `score.rs`: bounded score record and score formula.
- `update.rs`: smoothing and observation reduction.
- `decay.rs`: stale-score decay constants and reducer.
- `fairness.rs`: bounded retry credit.
- `ordering.rs`: deterministic candidate ordering.
- `tests.rs`: reducer and key tests.
