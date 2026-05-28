# Profile Tabs

## Purpose

This directory owns the timeline-like profile feed: header identity, copy
actions, about rendering, following count, authored note rows, and automatic
newer recovery.

## Table of Contents

- `ProfileTab.svelte`: runtime wiring, relay selection, paging, and notes.
- `ProfileHeader.svelte`: banner-safe full-width identity below avatar/actions,
  copy menu, actions, and facts.
- `ProfileAbout.svelte`: profile-only about text rendering with safe links.
