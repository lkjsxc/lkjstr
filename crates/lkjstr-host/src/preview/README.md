# Preview service

## Purpose

Optional same-origin metadata for linked public pages, isolated from accounts.

## Table of Contents

- mod.rs: HTTP routes, origin policy, concurrency and client rate limits.
- security.rs: target validation, public-address checks and pinned resolution.
- fetch.rs: bounded HTTP, manual redirects and oEmbed discovery.
- metadata.rs: Open Graph, Twitter, oEmbed and Japanese charset decoding.
- cache.rs: bounded persistent answers and negative cache.
- fetch_test.rs: redirect, shared-budget and fake-site HTTP regressions.
- tests.rs: loopback fake pages, refusal, metadata, cache and HTTP checks.
