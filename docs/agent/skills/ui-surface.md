# Skill: UI Surface

## Purpose

Change user-visible surfaces: shipped Svelte tabs and components, the shared
UI system, and target Leptos surfaces in `crates/lkjstr-ui`.

## Trigger

The change touches `src/lib/tabs/`, `src/lib/components/`,
`crates/lkjstr-ui`, or a contract under `docs/architecture/workspace/` or
`docs/product/`.

## Read First

- The product contract for the surface under `docs/product/feeds/` or
  `docs/product/tools/`.
- [../../architecture/workspace/ui-system/README.md](../../architecture/workspace/ui-system/README.md).
- [../../architecture/workspace/ui-system/polish-backlog.md](../../architecture/workspace/ui-system/polish-backlog.md)
  for active polish targets.
- [../../architecture/rust-wasm/ui-runtime.md](../../architecture/rust-wasm/ui-runtime.md)
  for Leptos work.
- [../../repository/functional-style.md](../../repository/functional-style.md).

## Files Likely Touched

- Shipped surfaces: `src/lib/tabs/<surface>/` and `src/lib/components/`.
- Target surfaces: `crates/lkjstr-ui/src/`.
- The matching product or ui-system contract, and
  [../../current-state.md](../../current-state.md) when shipped behavior
  changes.

## Procedure

1. Decide which runtime owns the change. Shipped behavior lives in Svelte
   until a Leptos surface reaches parity; Leptos work must not claim shipped
   ownership early.
2. Update the product or ui-system contract before source.
3. Render real data or explicit loading, unavailable, unsupported, denied, or
   diagnostic states only.
4. Keep pure view logic in reducers or view models; components stay thin and
   at or below 200 lines.
5. Keep one scroll owner per tab surface and preserve documented scroll and
   anchor semantics.

## Focused Gate

```sh
pnpm check
pnpm test -- tests/unit/<surface>
```

For Leptos surfaces add:

```sh
cargo test -p lkjstr-ui
pnpm rust-wasm:quiet
```

Use the surface row in
[../../architecture/rust-wasm/cutover/parity-ledger.md](../../architecture/rust-wasm/cutover/parity-ledger.md)
for the parity gate list.

## Final Gate

Run the Docker final gate before surface parity or deletion claims; otherwise
record it as not run.

## Must Not

- Do not add mock previews, placeholder counters, or placeholder success UI;
  see [../no-fake-data.md](../no-fake-data.md).
- Do not add first-party classes in `src/`.
- Do not introduce a second scroll owner inside a tab surface.
- Do not mark a parity-ledger surface `implemented` from a partial Leptos
  surface.
- Do not change Settings away from one flat key-value list.

## Handoff

Name the owning runtime for the changed surface and any parity-ledger row
that moved.
