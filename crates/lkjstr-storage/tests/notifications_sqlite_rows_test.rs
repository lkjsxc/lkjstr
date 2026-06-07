use lkjstr_storage::{
    NotificationRecord, notification_ledger_record, sqlite_cache_ledger_row_for_table,
    sqlite_notification_row,
};

#[test]
fn sqlite_notification_rows_keep_owner_and_timestamps() -> Result<(), serde_json::Error> {
    let row = NotificationRecord {
        notification_id: "owner:event:reply".to_owned(),
        owner_pubkey: "owner".to_owned(),
        source_event_id: "event".to_owned(),
        target_event_id: Some("target".to_owned()),
        root_event_id: Some("root".to_owned()),
        actor_pubkey: "actor".to_owned(),
        notification_kind: "reply".to_owned(),
        created_at: 1_700_000_001,
        updated_at_ms: 43,
    };

    let sqlite = sqlite_notification_row(&row);
    let ledger =
        sqlite_cache_ledger_row_for_table(&notification_ledger_record(&row)?, "notifications");

    assert_eq!(sqlite, row);
    assert_eq!(ledger.resource_id, row.notification_id);
    assert_eq!(ledger.resource_kind, "notification-record");
    assert_eq!(ledger.owner_key, Some("owner".to_owned()));
    assert_eq!(ledger.table_name, "notifications");
    Ok(())
}
