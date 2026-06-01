use lkjstr_protocol::NostrEvent;
use lkjstr_storage::{
    StoredEventRecord, event_cache_bytes, event_cache_ledger_record, event_from_sqlite_row,
    sqlite_cache_ledger_row_for_table, sqlite_event_relay_row, sqlite_event_row,
    sqlite_event_tag_rows,
};

#[test]
fn sqlite_event_rows_preserve_raw_event_and_tags() -> Result<(), Box<dyn std::error::Error>> {
    let event = sample_event();
    let record = StoredEventRecord {
        event: event.clone(),
        received_at_ms: 2_000,
        updated_at_ms: 3_000,
    };

    let row = sqlite_event_row(&record)?;
    let tags = sqlite_event_tag_rows(&event)?;
    let relay = sqlite_event_relay_row(&event.id, "wss://relay.example", 2_000, "read");
    let bytes = event_cache_bytes(&record, &tags, std::slice::from_ref(&relay))?;
    let ledger =
        sqlite_cache_ledger_row_for_table(&event_cache_ledger_record(&record, bytes), "events");

    assert_eq!(row.event_id, event.id);
    assert_eq!(event_from_sqlite_row(&row)?, record);
    assert_eq!(tags.len(), 2);
    assert_eq!(tags.first().map(|tag| tag.tag_name.as_str()), Some("e"));
    assert_eq!(
        tags.first().and_then(|tag| tag.value_0.as_deref()),
        Some("root")
    );
    assert_eq!(relay.first_seen_at_ms, relay.last_seen_at_ms);
    assert_eq!(ledger.resource_id, event.id);
    assert_eq!(ledger.resource_kind, "nostr-event");
    assert_eq!(ledger.table_name, "events");
    assert_eq!(ledger.score, 47_223_800);
    assert!(ledger.byte_count > 0);
    Ok(())
}

fn sample_event() -> NostrEvent {
    NostrEvent {
        id: "event-id".to_owned(),
        pubkey: "author".to_owned(),
        created_at: 1_700_000_000,
        kind: 1,
        tags: vec![
            vec!["e".to_owned(), "root".to_owned(), "wss://relay".to_owned()],
            vec!["p".to_owned(), "profile".to_owned()],
        ],
        content: "hello".to_owned(),
        sig: "signature".to_owned(),
    }
}
