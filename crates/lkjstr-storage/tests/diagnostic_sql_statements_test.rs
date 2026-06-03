use lkjstr_storage::{diagnostic_sqlite_statements, sqlite_schema_table, sqlite_statement};

#[test]
fn diagnostic_sqlite_statements_are_owned_by_documented_tables() {
    let statements = diagnostic_sqlite_statements();

    assert!(
        statements
            .iter()
            .any(|item| item.id == "relay_information.upsert")
    );
    assert!(
        statements
            .iter()
            .any(|item| item.id == "relay_diagnostic_summaries.upsert")
    );
    assert!(
        statements
            .iter()
            .any(|item| item.id == "relay_read_observations.insert")
    );
    assert!(
        statements
            .iter()
            .any(|item| item.id == "relay_read_scores.upsert")
    );
    assert!(
        statements
            .iter()
            .any(|item| item.id == "relay_list_suggestions.upsert")
    );
    assert!(
        statements
            .iter()
            .any(|item| item.id == "author_relay_routes.upsert")
    );
    assert!(
        statements
            .iter()
            .any(|item| item.id == "route_evidence_scores.upsert")
    );
    assert!(
        statements
            .iter()
            .any(|item| item.id == "relay_route_blocks.upsert")
    );
    assert!(statements.iter().any(|item| item.id == "jobs.upsert"));
    assert!(statements.iter().any(|item| item.id == "app_log.insert"));

    for statement in statements {
        assert!(
            sqlite_schema_table(statement.table_name).is_some(),
            "{} has undocumented table {}",
            statement.id,
            statement.table_name
        );
    }
    assert_eq!(
        sqlite_statement("relay_information.upsert"),
        statements
            .iter()
            .find(|item| item.id == "relay_information.upsert")
    );
}
