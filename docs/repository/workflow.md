Owner: Repository maintainers
State: Draft

# Workflow

Use a docs-first workflow for changes that affect direction, behavior,
operability, or repository structure.

## Change Flow

1. Update or add the relevant documentation.
2. Make the smallest implementation change that satisfies the documented intent.
3. Run available checks.
4. Record verification results in the handoff.
5. Commit ready work in small, reviewable units when commit creation is in scope.

## Verification

Run the checks that exist for the current stack. When a compose file is present,
include compose verification in the normal check set.

Examples of future checks:

- Documentation line-count checks.
- Source line-count checks.
- Unit or integration tests.
- Compose config validation.
- Compose startup checks for services that should boot locally.

## Collaboration

- Do not revert unrelated edits.
- Treat uncommitted changes by others as owned work.
- Keep changes scoped to the requested area.
- Report changed paths and verification results at handoff.
