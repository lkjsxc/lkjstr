# Line Limits

## Purpose

Line limits keep the repository readable by language models. They are product
rules, not style preferences.

## Caps

- Strict Markdown: 300 lines for `README.md`, `AGENTS.md`, and every
  `docs/**/*.md` file.
- Source: 200 lines for first-party TypeScript, Svelte, JavaScript, Rust, CSS,
  HTML, and scripts checked by repository tooling.
- Generated and lock files are excluded only when the checker explicitly skips
  them.

## Split Rules

- Split by ownership, not by arbitrary line count.
- Move pure logic out of Svelte components into nearby reducers, query builders,
  view models, or helpers.
- Move effect code into adapter or factory modules with explicit cleanup.
- Move reusable CSS into the closest surface stylesheet or token file.
- Split Rust files into model, parse, reduce, error, and tests modules when a
  file approaches the cap.
- Split long docs into a directory with a README and focused child files.

## Checker Commands

```sh
pnpm check:repo
cargo run -p lkjstr-xtask -- check-lines
```

## CI Contract

Repository checks fail when a tracked strict doc or source file exceeds its cap.
Do not silence the checker by moving product code into generated paths or
untracked files.

## Maintenance Notes

When a large edit is necessary, split the file first and keep behavior unchanged
before adding the new behavior. Commit the split separately when practical.
