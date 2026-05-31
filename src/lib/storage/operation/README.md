# Storage Operation

## Purpose

This directory owns typed storage results, deadline handling, operation
tracking, availability checks, and transaction wrappers.

## Table of Contents

No child documents.

## Contract

- Deadline fallback is not operation settlement.
- IndexedDB counters stay active until the underlying promise settles.
- Callers may collapse typed failures to fallbacks only at the edge.
