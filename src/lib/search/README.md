# Search

## Purpose

This directory contains relay-backed and cache-backed search helpers.

## Table of Contents

- [Contract](#contract)

## Contract

- Search reads local cached events before or alongside relay results.
- Relay search uses NIP-50 `search` filters against enabled read relays.
- Search results are stored through the shared event repository.
- Helpers return timeline-compatible `FeedEvent` records for tab rendering.
