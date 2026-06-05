# Feed Fragments

## Purpose

This source directory owns pure Rust planning for real visual feed rows produced
from oversized semantic Nostr events.

## Table of Contents

- [model.rs](model.rs): fragment constants, semantic event input, and visual row output.
- [text.rs](text.rs): Unicode-safe text segmentation.
- [keys.rs](keys.rs): stable content-derived fragment keys.
- [plan.rs](plan.rs): deterministic planner from semantic event to visual rows.
- [tests.rs](tests.rs): exact-content, key stability, and ordering coverage.

## Rules

The planner never creates fake events, fake previews, or nested scroll owners.
Text segments must join exactly to the original event content.
