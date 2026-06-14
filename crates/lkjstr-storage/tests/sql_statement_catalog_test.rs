use lkjstr_storage::{
    cache_sqlite_statements, optimizer_sqlite_statements, protected_sqlite_statements,
    sqlite_repository_statements, sqlite_schema_table, sqlite_statement,
};

#[test]
fn protected_sqlite_statements_are_owned_by_documented_tables() {
    let statements = protected_sqlite_statements();
    assert!(statements.iter().any(|item| item.id == "settings.upsert"));
    assert!(statements.iter().any(|item| item.id == "settings.clear"));
    assert!(statements.iter().any(|item| item.id == "cache_meta.select"));
    assert!(statements.iter().any(|item| item.id == "cache_meta.upsert"));
    assert!(statements.iter().any(|item| item.id == "workspaces.upsert"));
    assert!(statements.iter().any(|item| item.id == "tab_states.upsert"));
    assert!(
        statements
            .iter()
            .any(|item| item.id == "cache_ledger.upsert")
    );
    assert!(statements.iter().any(|item| item.id == "accounts.upsert"));
    assert!(statements.iter().any(|item| item.id == "relay_sets.upsert"));
    assert!(
        statements
            .iter()
            .any(|item| item.id == "tweet_drafts.upsert")
    );
    for statement in statements {
        assert!(sqlite_schema_table(statement.table_name).is_some());
        assert!(statement.sql.contains(statement.table_name));
    }
}

#[test]
fn cache_sqlite_statements_are_owned_by_documented_tables() {
    let statements = cache_sqlite_statements();
    assert!(statements.iter().any(|item| item.id == "events.upsert"));
    assert!(statements.iter().any(|item| item.id == "event_tags.upsert"));
    assert!(
        statements
            .iter()
            .any(|item| item.id == "event_relays.upsert")
    );
    assert!(
        statements
            .iter()
            .any(|item| item.id == "notifications.upsert")
    );
    assert!(
        statements
            .iter()
            .any(|item| item.id == "feed_scan_hints.upsert")
    );
    assert!(sqlite_repository_statements().len() > protected_sqlite_statements().len());
    assert!(
        sqlite_repository_statements()
            .iter()
            .any(|item| item.id == "event_search_tokens.upsert")
    );
    assert!(matches!(
        sqlite_statement("events.upsert"),
        Some(statement) if statement.table_name == "events"
    ));
    for statement in statements {
        assert!(sqlite_schema_table(statement.table_name).is_some());
    }
}

#[test]
fn optimizer_sqlite_statements_are_owned_by_documented_tables() {
    let statements = optimizer_sqlite_statements();
    assert!(
        statements
            .iter()
            .any(|item| item.id == "feed_scan_density_models.upsert")
    );
    assert!(
        statements
            .iter()
            .any(|item| item.id == "feed_row_height_models.upsert")
    );
    assert!(
        statements
            .iter()
            .any(|item| item.id == "feed_row_height_observations.delete_before")
    );
    for statement in statements {
        assert!(sqlite_schema_table(statement.table_name).is_some());
    }
}
