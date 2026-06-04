use lkjstr_storage::{
    AppLogRecord, AuthorRelayRouteRecord, JobRecord, RelayDiagnosticSummaryRecord,
    RelayInformationRecord, RelayListSuggestionRecord, RelayRouteBlockRecord,
    author_route_ledger_record, job_ledger_record, relay_info_ledger_record,
    relay_suggestion_ledger_record, relay_summary_ledger_record, sqlite_cache_ledger_row_for_table,
};

#[test]
fn relay_diagnostic_rows_map_to_relay_owned_ledger() -> Result<(), serde_json::Error> {
    let summary = RelayDiagnosticSummaryRecord {
        relay_url: relay_url(),
        summary_json: r#"{"attemptCount":1}"#.to_owned(),
        updated_at_ms: 3_600_000,
    };
    let info = RelayInformationRecord {
        relay_url: relay_url(),
        info_json: r#"{"name":"relay"}"#.to_owned(),
        fetched_at_ms: 3_600_000,
        updated_at_ms: 3_700_000,
    };
    let suggestion = RelayListSuggestionRecord {
        pubkey: "pubkey".to_owned(),
        relay_url: relay_url(),
        purpose: "read".to_owned(),
        source_event_id: "event".to_owned(),
        updated_at_ms: 3_600_000,
    };
    let route = AuthorRelayRouteRecord {
        pubkey: "pubkey".to_owned(),
        relay_url: relay_url(),
        route_kind: "nip65".to_owned(),
        evidence_json: r#"{"source":"kind10002"}"#.to_owned(),
        updated_at_ms: 3_600_000,
        expires_at_ms: Some(7_200_000),
    };

    let summary_ledger = sqlite_cache_ledger_row_for_table(
        &relay_summary_ledger_record(&summary)?,
        "relay_diagnostic_summaries",
    );
    let info_ledger =
        sqlite_cache_ledger_row_for_table(&relay_info_ledger_record(&info)?, "relay_information");
    let suggestion_ledger = sqlite_cache_ledger_row_for_table(
        &relay_suggestion_ledger_record(&suggestion)?,
        "relay_list_suggestions",
    );
    let route_ledger = sqlite_cache_ledger_row_for_table(
        &author_route_ledger_record(&route)?,
        "author_relay_routes",
    );

    assert_eq!(summary_ledger.resource_kind, "relay-summary");
    assert_eq!(summary_ledger.score, 81);
    assert_eq!(info_ledger.resource_kind, "relay-info");
    assert_eq!(info_ledger.score, 351);
    assert_eq!(
        suggestion_ledger.owner_key.as_deref(),
        Some("wss://relay.example")
    );
    assert_eq!(route_ledger.resource_kind, "author-relay-route");
    assert_eq!(
        route_ledger.owner_key.as_deref(),
        Some("wss://relay.example")
    );
    Ok(())
}

#[test]
fn job_route_block_and_app_log_rows_keep_protection_shape() -> Result<(), serde_json::Error> {
    let queued = sample_job("queued");
    let failed = sample_job("failed");
    let queued_ledger = job_ledger_record(&queued)?;
    let failed_ledger = job_ledger_record(&failed)?;
    let block = RelayRouteBlockRecord {
        relay_url: relay_url(),
        pubkey: "pubkey".to_owned(),
        reason: "user-disabled".to_owned(),
        created_at_ms: 9,
    };
    let log = AppLogRecord {
        log_id: "log".to_owned(),
        area: "runtime".to_owned(),
        level: "error".to_owned(),
        code: "window-error".to_owned(),
        message: "failed".to_owned(),
        context_json: "{}".to_owned(),
        record_json: "{}".to_owned(),
        created_at_ms: 10,
    };

    assert!(queued_ledger.protected);
    assert_eq!(queued_ledger.reason.as_deref(), Some("active-job"));
    assert!(!failed_ledger.protected);
    assert_eq!(failed_ledger.score, 251);
    assert_eq!(block.pubkey, "pubkey");
    assert_eq!(log.context_json, "{}");
    Ok(())
}

fn sample_job(state: &str) -> JobRecord {
    JobRecord {
        job_id: format!("job-{state}"),
        job_kind: "publish".to_owned(),
        state: state.to_owned(),
        owner_id: Some("owner".to_owned()),
        payload_json: "{}".to_owned(),
        created_at_ms: 1,
        updated_at_ms: 3_600_000,
        finished_at_ms: if state == "queued" { None } else { Some(4) },
    }
}

fn relay_url() -> String {
    "wss://relay.example".to_owned()
}
