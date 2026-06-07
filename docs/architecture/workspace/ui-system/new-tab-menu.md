# New Tab Menu

## Purpose

New Tab is the workspace catalog for opening tool and feed tabs.

## Layout

- One flat option grid in canonical catalog order.
- Each option is an `option-card` button with label and short description.
- No search input, filter label, result count, or primary/secondary headings.
- No-results state is not applicable because every catalog item is always
  visible.

## Catalog Source

- TypeScript: `src/lib/tabs/new-tab/new-tab-options.ts`
- Rust domain: `crates/lkjstr-domain/src/workspace/tab_catalog.rs`

Both sources must stay aligned on labels, descriptions, kinds, aliases, and
conditional entries such as My Profile and `lkjsxc`.

## Conditional Entries

- My Profile appears only when a signing account is active.
- `lkjsxc` opens the fixed public User Timeline pubkey.

## Interaction

- Clicking an option converts the current New Tab into the chosen tab kind.
- Keyboard focus order walks the option grid directly.

## Styling

- New Tab uses `.form-tab` / `.new-tab` scroll ownership.
- Option cards use the shared tables option-grid styles.
- Svelte and Leptos use the same card content even when markup differs.

## Related

- [../../../product/workspace/tabs.md](../../../product/workspace/tabs.md).
- [../tab-shell-layout.md](../tab-shell-layout.md).
