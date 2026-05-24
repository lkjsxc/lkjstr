# Documentation Standards

## Purpose

Documentation should be readable by people and language models. Treat the root
documentation files and `docs/` as the strict documentation tree. Source, test,
script, and static `README.md` files are local maps.

## File Shape

Every documentation file starts with an H1, then a `Purpose` section. Each
documentation directory has one `README.md` local table of contents. Every
directory under `docs/` uses its `README.md` as a recursive table of contents
for that subtree.

## Content Rules

- Write English docs.
- Put the most useful summary near the top.
- Keep one topic per file.
- Link related files with relative Markdown links.
- Keep each file at or below 300 lines.
- Keep source files at or below 200 lines.
- Update docs before implementation when behavior, contracts, or workflows
  change.
- Keep docs and implementation in the same change when they define one behavior.
- Avoid milestone labels in filenames and headings.
- Avoid numeric release shorthand and named release phases.
- Avoid backward-compatibility framing. State the current contract directly.
- Use explicit statuses: implemented, design-only, not implemented, out of
  scope, or open question.
- Record uncertainty as an explicit assumption or open question.

## Directory Rules

- Every tracked, non-generated directory contains one `README.md`.
- Strict recursive topology applies only to `docs/` and root documentation.
- Each directory under `docs/` has a `README.md` plus at least two Markdown
  files or child directories.
- `docs/README.md` is the recursive table of contents for the full docs tree.
- Child `README.md` files recursively list descendant documentation for that
  subtree.
- Supporting files hold the detail so the `README.md` remains scannable.
- Root documentation links to canonical `docs/` pages instead of repeating
  long product or protocol contracts.

## Product Rules

- Settings remains a flat vertical key-value list.
- Docker Compose services do not mount the source tree, use `develop`, or use
  watch-style sync.
- Docker Compose is the authoritative final verification path.
