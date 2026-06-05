# Feed Geometry

## Purpose

This module owns pure row height feature extraction, height estimation,
measured-height model updates, and scroll-anchor compensation decisions.

## Table of Contents

- [mod.rs](mod.rs): module exports.
- [features.rs](features.rs): stable row geometry features.
- [estimate.rs](estimate.rs): estimated row heights and confidence.
- [model.rs](model.rs): measured height observations and model updates.
- [width_bucket.rs](width_bucket.rs): stable row width buckets.
- [anchor.rs](anchor.rs): scroll delta compensation.
- [tests.rs](tests.rs): unit coverage.
