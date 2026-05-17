Owner: Repository maintainers
State: Draft

# Layout

The repository contains a SvelteKit app scaffold, verification tooling, compose
services, tests, and documentation.

```text
.
├── AGENTS.md
├── LICENSE
├── README.md
├── compose.yaml
├── docs/
    ├── README.md
    ├── current-state.md
    ├── repository/
    └── vision/
├── package.json
├── scripts/
├── src/
└── tests/
```

## Direction

Future directories should be added only when they have a clear responsibility.
When implementation begins, prefer names that describe the role of the code
rather than temporary milestones.

Expected boundaries:

- `docs/` contains maintained project knowledge.
- `src/` contains application source.
- `tests/` contains automated test entry points.
- `scripts/` contains repository automation.
- Root package and tooling files are standard entry points for the selected
  stack.

## Constraints

- Each documentation directory has one `README.md`.
- Each documentation directory also has supporting Markdown files or
  subdirectories.
- Documentation files stay at or below 300 lines.
- Source files stay at or below 200 lines where practical.
