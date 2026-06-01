#![doc = "SQLite protected table records."]

use crate::{
    data_class::{StorageDataClass as DataClass, StorageInventoryGroup as Group},
    sql::{SqliteRetentionClass as Retention, SqliteTableSpec},
};

macro_rules! protected {
    ($name:literal, $owner:literal, $sql:literal) => {
        SqliteTableSpec {
            name: $name,
            create_sql: $sql,
            data_class: DataClass::ProtectedUserData,
            inventory_group: Group::Protected,
            primary_owner: $owner,
            retention: Retention::Protected,
            ledger_resource_kind: None,
        }
    };
}

pub const SQLITE_PROTECTED_TABLES: &[SqliteTableSpec] = &[
    SqliteTableSpec {
        name: "schema_meta",
        create_sql: r#"CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;"#,
        data_class: DataClass::Metadata,
        inventory_group: Group::Metadata,
        primary_owner: "storage",
        retention: Retention::Metadata,
        ledger_resource_kind: None,
    },
    protected!(
        "workspaces",
        "workspace",
        r#"CREATE TABLE IF NOT EXISTS workspaces (
  workspace_id TEXT PRIMARY KEY,
  layout_json TEXT NOT NULL,
  active_pane_id TEXT,
  active_tab_id TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;"#
    ),
    SqliteTableSpec {
        name: "tab_states",
        create_sql: r#"CREATE TABLE IF NOT EXISTS tab_states (
  workspace_id TEXT NOT NULL,
  tab_id TEXT NOT NULL,
  tab_kind TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  scroll_anchor_json TEXT,
  updated_at_ms INTEGER NOT NULL,
  stale_after_ms INTEGER,
  PRIMARY KEY (workspace_id, tab_id)
) STRICT;"#,
        data_class: DataClass::ProtectedUserData,
        inventory_group: Group::Protected,
        primary_owner: "workspace",
        retention: Retention::DynamicProtected,
        ledger_resource_kind: Some(crate::resource::CacheResourceKind::TabState),
    },
    protected!(
        "settings",
        "settings",
        r#"CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;"#
    ),
    protected!(
        "accounts",
        "accounts",
        r#"CREATE TABLE IF NOT EXISTS accounts (
  pubkey TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  signer_kind TEXT NOT NULL CHECK (signer_kind IN ('local', 'nip07', 'readonly')),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  metadata_json TEXT NOT NULL
) STRICT;"#
    ),
    protected!(
        "local_account_secrets",
        "signer",
        r#"CREATE TABLE IF NOT EXISTS local_account_secrets (
  pubkey TEXT PRIMARY KEY REFERENCES accounts(pubkey) ON DELETE CASCADE,
  secret_payload TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;"#
    ),
    protected!(
        "relay_sets",
        "relays",
        r#"CREATE TABLE IF NOT EXISTS relay_sets (
  set_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  relays_json TEXT NOT NULL,
  selected_read INTEGER NOT NULL CHECK (selected_read IN (0, 1)),
  selected_write INTEGER NOT NULL CHECK (selected_write IN (0, 1)),
  updated_at_ms INTEGER NOT NULL
) STRICT;"#
    ),
    SqliteTableSpec {
        name: "relay_route_blocks",
        create_sql: r#"CREATE TABLE IF NOT EXISTS relay_route_blocks (
  relay_url TEXT NOT NULL,
  pubkey TEXT,
  reason TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  PRIMARY KEY (relay_url, pubkey)
) STRICT;"#,
        data_class: DataClass::ProtectedSafetyConfiguration,
        inventory_group: Group::ProtectedSafety,
        primary_owner: "relays",
        retention: Retention::Protected,
        ledger_resource_kind: None,
    },
    protected!(
        "tweet_drafts",
        "tweet",
        r#"CREATE TABLE IF NOT EXISTS tweet_drafts (
  draft_id TEXT PRIMARY KEY,
  owner_pubkey TEXT,
  body TEXT NOT NULL,
  attachments_json TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;"#
    ),
];
