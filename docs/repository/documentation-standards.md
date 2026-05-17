Owner: Repository maintainers
State: Draft

# Documentation Standards

Documentation should be readable by people and language models. Prefer direct
headings, short sections, and explicit constraints over narrative background.

## File Shape

Every documentation file starts with:

```text
Owner: <owner>
State: <state>
```

Use `State` to make maturity clear, such as `Draft`, `Active`, or `Archived`.

## Content Rules

- Put the most useful summary near the top.
- Keep one topic per file.
- Link related files with relative Markdown links.
- Keep each file at or below 300 lines.
- Avoid milestone labels in filenames and headings.
- Record uncertainty as an explicit assumption or open question.

## Directory Rules

- A documentation directory contains exactly one `README.md`.
- A `README.md` orients readers and links to sibling topics.
- Supporting files hold the detail so the `README.md` remains scannable.
