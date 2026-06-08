#![doc = "SQLite repository statement records."]

use crate::{StorageOperation as Op, sql::SqliteStatementSpec};

pub const PROTECTED_STATEMENTS: &[SqliteStatementSpec] = &[
    read(
        "settings.select",
        "settings",
        "SELECT key, value_json, updated_at_ms FROM settings WHERE key = ?1;",
    ),
    read(
        "settings.all",
        "settings",
        "SELECT key, value_json, updated_at_ms FROM settings ORDER BY key ASC;",
    ),
    write(
        "settings.upsert",
        "settings",
        "INSERT INTO settings (key, value_json, updated_at_ms) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at_ms = excluded.updated_at_ms;",
    ),
    write(
        "settings.delete",
        "settings",
        "DELETE FROM settings WHERE key = ?1;",
    ),
    write("settings.clear", "settings", "DELETE FROM settings;"),
    read(
        "cache_meta.select",
        "cache_meta",
        "SELECT key, value_json, updated_at_ms FROM cache_meta WHERE key = ?1;",
    ),
    write(
        "cache_meta.upsert",
        "cache_meta",
        "INSERT INTO cache_meta (key, value_json, updated_at_ms) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at_ms = excluded.updated_at_ms;",
    ),
    read(
        "workspaces.select",
        "workspaces",
        "SELECT workspace_id, layout_json, active_pane_id, active_tab_id, created_at_ms, updated_at_ms FROM workspaces WHERE workspace_id = ?1;",
    ),
    write(
        "workspaces.upsert",
        "workspaces",
        "INSERT INTO workspaces (workspace_id, layout_json, active_pane_id, active_tab_id, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(workspace_id) DO UPDATE SET layout_json = excluded.layout_json, active_pane_id = excluded.active_pane_id, active_tab_id = excluded.active_tab_id, updated_at_ms = excluded.updated_at_ms;",
    ),
    read(
        "tab_states.select",
        "tab_states",
        "SELECT workspace_id, tab_id, tab_kind, snapshot_json, scroll_anchor_json, updated_at_ms, stale_after_ms FROM tab_states WHERE workspace_id = ?1 AND tab_id = ?2;",
    ),
    read(
        "tab_states.by_workspace",
        "tab_states",
        "SELECT workspace_id, tab_id, tab_kind, snapshot_json, scroll_anchor_json, updated_at_ms, stale_after_ms FROM tab_states WHERE workspace_id = ?1 ORDER BY updated_at_ms ASC, tab_id ASC;",
    ),
    write(
        "tab_states.upsert",
        "tab_states",
        "INSERT INTO tab_states (workspace_id, tab_id, tab_kind, snapshot_json, scroll_anchor_json, updated_at_ms, stale_after_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(workspace_id, tab_id) DO UPDATE SET tab_kind = excluded.tab_kind, snapshot_json = excluded.snapshot_json, scroll_anchor_json = excluded.scroll_anchor_json, updated_at_ms = excluded.updated_at_ms, stale_after_ms = excluded.stale_after_ms;",
    ),
    write(
        "tab_states.delete",
        "tab_states",
        "DELETE FROM tab_states WHERE workspace_id = ?1 AND tab_id = ?2;",
    ),
    read(
        "cache_ledger.select",
        "cache_ledger",
        "SELECT resource_id, resource_kind, table_name, byte_count, protected, score, owner_key, created_at_ms, updated_at_ms FROM cache_ledger WHERE resource_id = ?1;",
    ),
    write(
        "cache_ledger.upsert",
        "cache_ledger",
        "INSERT INTO cache_ledger (resource_id, resource_kind, table_name, byte_count, protected, score, owner_key, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT(resource_id) DO UPDATE SET resource_kind = excluded.resource_kind, table_name = excluded.table_name, byte_count = excluded.byte_count, protected = excluded.protected, score = excluded.score, owner_key = excluded.owner_key, updated_at_ms = excluded.updated_at_ms;",
    ),
    write(
        "cache_ledger.delete",
        "cache_ledger",
        "DELETE FROM cache_ledger WHERE resource_id = ?1;",
    ),
    read(
        "accounts.select",
        "accounts",
        "SELECT pubkey, label, signer_kind, created_at_ms, updated_at_ms, metadata_json FROM accounts WHERE pubkey = ?1;",
    ),
    read(
        "accounts.all",
        "accounts",
        "SELECT pubkey, label, signer_kind, created_at_ms, updated_at_ms, metadata_json FROM accounts ORDER BY updated_at_ms DESC, pubkey DESC;",
    ),
    write(
        "accounts.upsert",
        "accounts",
        "INSERT INTO accounts (pubkey, label, signer_kind, created_at_ms, updated_at_ms, metadata_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(pubkey) DO UPDATE SET label = excluded.label, signer_kind = excluded.signer_kind, updated_at_ms = excluded.updated_at_ms, metadata_json = excluded.metadata_json;",
    ),
    write(
        "accounts.delete",
        "accounts",
        "DELETE FROM accounts WHERE pubkey = ?1;",
    ),
    read(
        "local_account_secrets.select",
        "local_account_secrets",
        "SELECT pubkey, secret_payload, created_at_ms, updated_at_ms FROM local_account_secrets WHERE pubkey = ?1;",
    ),
    write(
        "local_account_secrets.upsert",
        "local_account_secrets",
        "INSERT INTO local_account_secrets (pubkey, secret_payload, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(pubkey) DO UPDATE SET secret_payload = excluded.secret_payload, updated_at_ms = excluded.updated_at_ms;",
    ),
    write(
        "local_account_secrets.delete",
        "local_account_secrets",
        "DELETE FROM local_account_secrets WHERE pubkey = ?1;",
    ),
    read(
        "relay_sets.select",
        "relay_sets",
        "SELECT set_id, name, relays_json, selected_read, selected_write, updated_at_ms FROM relay_sets WHERE set_id = ?1;",
    ),
    read(
        "relay_sets.all",
        "relay_sets",
        "SELECT set_id, name, relays_json, selected_read, selected_write, updated_at_ms FROM relay_sets ORDER BY updated_at_ms DESC, set_id ASC;",
    ),
    write(
        "relay_sets.upsert",
        "relay_sets",
        "INSERT INTO relay_sets (set_id, name, relays_json, selected_read, selected_write, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(set_id) DO UPDATE SET name = excluded.name, relays_json = excluded.relays_json, selected_read = excluded.selected_read, selected_write = excluded.selected_write, updated_at_ms = excluded.updated_at_ms;",
    ),
    read(
        "tweet_drafts.select",
        "tweet_drafts",
        "SELECT draft_id, owner_pubkey, body, attachments_json, tags_json, updated_at_ms FROM tweet_drafts WHERE draft_id = ?1;",
    ),
    write(
        "tweet_drafts.upsert",
        "tweet_drafts",
        "INSERT INTO tweet_drafts (draft_id, owner_pubkey, body, attachments_json, tags_json, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(draft_id) DO UPDATE SET owner_pubkey = excluded.owner_pubkey, body = excluded.body, attachments_json = excluded.attachments_json, tags_json = excluded.tags_json, updated_at_ms = excluded.updated_at_ms;",
    ),
    write(
        "tweet_drafts.delete",
        "tweet_drafts",
        "DELETE FROM tweet_drafts WHERE draft_id = ?1;",
    ),
];

const fn read(id: &'static str, table: &'static str, sql: &'static str) -> SqliteStatementSpec {
    statement(id, table, sql, Op::Read)
}

const fn write(id: &'static str, table: &'static str, sql: &'static str) -> SqliteStatementSpec {
    statement(id, table, sql, Op::Write)
}

const fn statement(
    id: &'static str,
    table_name: &'static str,
    sql: &'static str,
    operation: Op,
) -> SqliteStatementSpec {
    SqliteStatementSpec {
        id,
        sql,
        table_name,
        operation,
    }
}
