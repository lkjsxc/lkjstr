# Documentation Standards

## Purpose

Documentation should be readable by people and language models. Prefer direct
headings, short sections, and explicit constraints over narrative background.

## File Shape

Every documentation file starts with an H1, then `Purpose`, `Tree` when useful,
and `Documents` when the file orients a directory.

## Content Rules

- Write English docs.
- Put the most useful summary near the top.
- Keep one topic per file.
- Link related files with relative Markdown links.
- Keep each file at or below 300 lines.
- Keep source files at or below 200 lines.
- Update docs before implementation when behavior, contracts, or workflows
  change.
- Avoid milestone labels in filenames and headings.
- Avoid release shorthand wording.
- Record uncertainty as an explicit assumption or open question.

## Directory Rules

- A documentation directory contains exactly one `README.md`.
- A `README.md` orients readers with a flat table of contents for sibling
  topics.
- Supporting files hold the detail so the `README.md` remains scannable.

## Product Rules

- Settings remains a flat vertical key-value list.
- Docker Compose services do not mount the source tree, use `develop`, or use
  watch-style sync.
