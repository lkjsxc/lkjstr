use lkjstr_storage::{
    FeedCoverageRecord, FeedCursorRecord, FeedScanHintRecord, feed_coverage_from_sqlite_row,
    feed_coverage_ledger_record, feed_cursor_ledger_record, feed_scan_hint_ledger_record,
    sqlite_cache_ledger_row_for_table, sqlite_feed_coverage_row, sqlite_feed_cursor_row,
    sqlite_feed_scan_hint_row,
};

#[test]
fn sqlite_feed_cache_rows_map_ledger_and_dense_state() -> Result<(), serde_json::Error> {
    let cursor = FeedCursorRecord {
        cursor_id: "cursor".to_owned(),
        feed_key: "home:alice".to_owned(),
        relay_set_key: "default".to_owned(),
        direction: "older".to_owned(),
        cursor_json: r#"{"until":10}"#.to_owned(),
        updated_at_ms: 10,
    };
    let coverage = FeedCoverageRecord {
        coverage_id: "coverage".to_owned(),
        feed_key: cursor.feed_key.clone(),
        relay_url: "wss://relay.example".to_owned(),
        filter_fingerprint: "filter".to_owned(),
        since_exclusive: Some(1),
        until_exclusive: Some(9),
        completed_at_ms: 11,
        event_count: 2,
        dense: true,
    };
    let hint = FeedScanHintRecord {
        semantic_feed_key: cursor.feed_key.clone(),
        route_group_key: "selected".to_owned(),
        relay_url: coverage.relay_url.clone(),
        semantic_filter_key: coverage.filter_fingerprint.clone(),
        direction: "older".to_owned(),
        route_fingerprint: "route".to_owned(),
        current_span_seconds: 60,
        next_span_seconds: 120,
        min_span_seconds: 1,
        max_span_seconds: 3600,
        last_feedback: "under-half".to_owned(),
        density_ewma: 0.2,
        complete_window_count: 1,
        dense_window_count: 0,
        incomplete_window_count: 0,
        last_since: 1,
        last_until: 61,
        updated_at_ms: 12,
        expires_at_ms: 13,
    };

    let sqlite_coverage = sqlite_feed_coverage_row(&coverage);
    assert_eq!(sqlite_feed_cursor_row(&cursor), cursor);
    assert_eq!(feed_coverage_from_sqlite_row(&sqlite_coverage), coverage);
    assert_eq!(sqlite_coverage.dense, 1);
    assert_eq!(sqlite_feed_scan_hint_row(&hint), hint);
    assert_eq!(
        sqlite_cache_ledger_row_for_table(&feed_cursor_ledger_record(&cursor)?, "feed_cursors")
            .resource_kind,
        "feed-cursor"
    );
    assert_eq!(
        sqlite_cache_ledger_row_for_table(
            &feed_coverage_ledger_record(&coverage)?,
            "feed_coverage",
        )
        .table_name,
        "feed_coverage"
    );
    assert_eq!(
        sqlite_cache_ledger_row_for_table(
            &feed_scan_hint_ledger_record(&hint)?,
            "feed_scan_hints",
        )
        .resource_kind,
        "scan-hint"
    );
    Ok(())
}
