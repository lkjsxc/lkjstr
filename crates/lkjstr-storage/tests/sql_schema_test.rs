use lkjstr_storage::{
    CacheResourceKind, SqliteRetentionClass, SqliteStatementKind, StorageDataClass,
    StorageInventoryGroup, sqlite_schema_hash, sqlite_schema_index_names, sqlite_schema_indexes,
    sqlite_schema_statements, sqlite_schema_table, sqlite_schema_table_names, sqlite_schema_tables,
};

#[test]
#[rustfmt::skip]
fn sqlite_schema_contains_target_tables() {
    assert_eq!(sqlite_schema_table_names(), vec![
        "schema_meta", "workspaces", "tab_states", "settings", "accounts", "local_account_secrets",
        "relay_sets", "relay_route_blocks", "tweet_drafts", "events", "event_tags", "event_relays",
        "notifications", "feed_cursors", "feed_coverage", "feed_scan_hints", "jobs", "event_search_tokens",
        "feed_scan_observations", "feed_scan_density_models", "feed_scan_decision_traces", "relay_information",
        "relay_diagnostic_summaries", "relay_read_observations", "relay_read_scores", "relay_list_suggestions",
        "author_relay_routes", "route_evidence_scores", "app_log", "cache_ledger", "cache_meta",
    ]);
}

#[test]
#[rustfmt::skip]
fn sqlite_schema_contains_target_indexes() {
    assert_eq!(sqlite_schema_index_names(), vec![
        "tab_states_by_workspace_updated", "events_by_kind_time", "events_by_pubkey_kind_time",
        "event_tags_lookup", "event_relays_by_relay", "event_search_tokens_lookup",
        "event_search_tokens_event", "notifications_by_owner_time", "feed_coverage_lookup", "feed_scan_hints_lookup",
        "feed_scan_observations_recent", "feed_scan_density_models_context",
        "relay_read_observations_recent", "relay_read_scores_recent",
        "route_evidence_scores_author", "jobs_by_state_updated", "cache_ledger_prune", "app_log_by_time",
    ]);

    for index in sqlite_schema_indexes() {
        assert!(sqlite_schema_table(index.table_name).is_some());
        assert!(index.create_sql.contains(index.name));
        assert!(index.create_sql.contains(index.table_name));
    }
}

#[test]
fn sqlite_tables_have_strict_create_statements() {
    for table in sqlite_schema_tables() {
        assert!(table.create_sql.starts_with("CREATE TABLE IF NOT EXISTS "));
        assert!(table.create_sql.contains(table.name));
        assert!(table.create_sql.ends_with("STRICT;"));
        assert!(!table.create_sql.contains("WAL"));
    }
}

#[test]
fn sqlite_schema_maps_classes_and_retention() {
    let accounts = sqlite_schema_table("accounts");
    assert!(matches!(
        accounts,
        Some(table) if table.data_class == StorageDataClass::ProtectedUserData
            && table.inventory_group == StorageInventoryGroup::Protected
            && table.retention == SqliteRetentionClass::Protected
    ));

    let blocks = sqlite_schema_table("relay_route_blocks");
    assert!(matches!(
        blocks,
        Some(table) if table.data_class == StorageDataClass::ProtectedSafetyConfiguration
            && table.inventory_group == StorageInventoryGroup::ProtectedSafety
    ));

    let ledger = sqlite_schema_table("cache_ledger");
    assert!(matches!(
        ledger,
        Some(table) if table.data_class == StorageDataClass::Ledger
            && table.retention == SqliteRetentionClass::Ledger
    ));
}

#[test]
fn sqlite_schema_maps_ledger_resources() {
    assert!(matches!(
        sqlite_schema_table("events"),
        Some(table) if table.ledger_resource_kind == Some(CacheResourceKind::NostrEvent)
    ));
    assert!(matches!(
        sqlite_schema_table("event_tags"),
        Some(table) if table.ledger_resource_kind == Some(CacheResourceKind::NostrEvent)
    ));
    assert!(matches!(
        sqlite_schema_table("event_search_tokens"),
        Some(table) if table.ledger_resource_kind == Some(CacheResourceKind::NostrEvent)
    ));
    assert!(matches!(
        sqlite_schema_table("notifications"),
        Some(table) if table.ledger_resource_kind == Some(CacheResourceKind::NotificationRecord)
    ));
    assert!(matches!(
        sqlite_schema_table("feed_coverage"),
        Some(table) if table.ledger_resource_kind == Some(CacheResourceKind::CoverageRow)
    ));
    assert!(matches!(
        sqlite_schema_table("relay_read_scores"),
        Some(table) if table.ledger_resource_kind == Some(CacheResourceKind::RelayReadScore)
    ));
    assert!(matches!(
        sqlite_schema_table("feed_scan_density_models"),
        Some(table) if table.ledger_resource_kind == Some(CacheResourceKind::ScanDensityModel)
    ));
    assert!(matches!(
        sqlite_schema_table("route_evidence_scores"),
        Some(table) if table.ledger_resource_kind == Some(CacheResourceKind::RouteEvidenceScore)
    ));
    assert!(matches!(
        sqlite_schema_table("jobs"),
        Some(table) if table.ledger_resource_kind == Some(CacheResourceKind::JobRecord)
    ));
}

#[test]
fn sqlite_schema_statements_start_with_foreign_keys() {
    let statements = sqlite_schema_statements();
    assert!(matches!(
        statements.first(),
        Some(statement) if statement.kind == SqliteStatementKind::Pragma
            && statement.sql == "PRAGMA foreign_keys = ON;"
    ));
    assert_eq!(
        statements.len(),
        1 + sqlite_schema_tables().len() + sqlite_schema_indexes().len()
    );
}

#[test]
fn sqlite_schema_hash_is_stable_shape() {
    let hash = sqlite_schema_hash();
    assert_eq!(hash.len(), 16);
    assert!(hash.chars().all(|value| value.is_ascii_hexdigit()));
}
