# Commit Protocol

## Purpose

Commit protocol docs define the required decision-record shape for repository
history.

## Lore Format

Every commit message starts with one concise intent line that says why the
change exists. The body may add short rationale when the decision needs context.

Use git trailers when they add useful constraints:

```text
Constraint: external constraint that shaped the decision
Rejected: alternative considered | reason
Confidence: low|medium|high
Scope-risk: narrow|moderate|broad
Directive: warning for later modifiers
Tested: checks that passed
Not-tested: known gaps
```

## Rules

- The first line is intent, not a file-change summary.
- `Rejected:` records alternatives that should not be rechecked without new
  evidence.
- `Directive:` records forward constraints for later edits.
- `Tested:` and `Not-tested:` must match actual verification evidence.
- Keep messages concise and specific to the committed slice.
