Owner: Architecture
State: Canon

# Post Manager Runtime

## Role

The post manager runtime owns local draft trees, edit persistence, collapse
state, and publish status records for the Posts tab.

## Data Flow

- Load the active account before loading or creating a tree.
- One tree is created per account pubkey when first needed.
- Nodes persist in IndexedDB and are ordered by tree references.
- Draft edits save through debounced writes.
- Archive marks a draft as archived-local instead of deleting it.
- Duplicate creates a new draft node with copied title and content.
- Publish state is stored on nodes and does not remove draft content.

## Boundaries

- Automatic cache pruning never deletes post trees or draft nodes.
- Signing and publish require a signer account and write relays.
- Read-only accounts can create and edit drafts locally.

## Acceptance

- Draft trees survive reload.
- Child reply drafts keep parent links.
- Failed publish state stays visible until the user changes it.
