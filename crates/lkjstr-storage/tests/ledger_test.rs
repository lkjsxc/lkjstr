use lkjstr_storage::{
    CacheResourceKind, direct_ledger_resource_specs, is_storage_table_name, ledger_resource_kinds,
    ledger_resource_spec, ledger_resource_specs, sqlite_schema_table,
};

#[test]
fn ledger_manifest_covers_each_resource_once() {
    let kinds = ledger_resource_kinds();
    assert_eq!(
        kinds,
        vec![
            CacheResourceKind::NostrEvent,
            CacheResourceKind::NotificationRecord,
            CacheResourceKind::FeedCursor,
            CacheResourceKind::CoverageRow,
            CacheResourceKind::ScanHint,
            CacheResourceKind::TabState,
            CacheResourceKind::RelaySummary,
            CacheResourceKind::RelayInfo,
            CacheResourceKind::RelayReadObservation,
            CacheResourceKind::RelayReadScore,
            CacheResourceKind::RelayListSuggestion,
            CacheResourceKind::AuthorRelayRoute,
            CacheResourceKind::RouteEvidenceScore,
            CacheResourceKind::JobRecord,
        ]
    );

    for (index, kind) in kinds.iter().enumerate() {
        assert!(!kinds.iter().skip(index + 1).any(|other| other == kind));
    }
}

#[test]
fn ledger_resources_map_to_live_tables() {
    for spec in ledger_resource_specs() {
        assert!(
            is_storage_table_name(spec.owning_table)
                || sqlite_schema_table(spec.owning_table).is_some()
        );
        assert_eq!(ledger_resource_spec(spec.resource_kind), Some(spec));
    }
}

#[test]
fn event_resources_stay_on_specialized_delete_path() {
    let direct = direct_ledger_resource_specs();
    assert!(
        !direct
            .iter()
            .any(|spec| spec.resource_kind == CacheResourceKind::NostrEvent)
    );
    assert!(matches!(
        ledger_resource_spec(CacheResourceKind::NostrEvent),
        Some(spec) if spec.event_owned
    ));
}
