# Event Components

## Purpose

This directory owns shared Nostr event display: rows, content, references,
actions, reaction summaries, zaps, emoji, and media.

## Table of Contents

- Event rows, metadata, content tokens, mention chips, custom emoji images,
  embeds, media, reaction actor lists, and action panels.
- `EventContentCore.svelte` owns the shared content, media, reference,
  sensitive-content, and emoji pipeline.
- `EventRepostTarget.svelte` renders reposted targets through that shared
  pipeline with contextual repost chrome.
