use lkjstr_app::feed::FeedEventContent;
use lkjstr_app::{
    EventDisplayContext, FeedFragmentConfig, FeedStateRow, FeedViewModelInput, FeedViewRow,
    FeedWindowEvidence, FeedWindowFlags, RowGeometryModel, build_feed_view_model,
    empty_feed_window, footer_row_from_window, reduce_feed_window,
};
use lkjstr_protocol::{
    KIND_GENERIC_REPOST, KIND_REACTION, KIND_REPOST, KIND_ZAP_RECEIPT, NostrEvent,
};
use lkjstr_relays::ProgressiveEvent;

#[test]
fn feed_view_model_replaces_action_event_bodies_with_bounded_rows() -> Result<(), String> {
    for (kind, content, expected) in [
        (
            KIND_REPOST,
            "{".repeat(3_000),
            "Reposted target unavailable",
        ),
        (
            KIND_GENERIC_REPOST,
            r#"{"kind":30023,"tags":[["e","target"]]}"#.to_owned(),
            "Reposted target unavailable",
        ),
        (KIND_REACTION, "+".to_owned(), "Reacted with +"),
        (
            KIND_ZAP_RECEIPT,
            r#"{"bolt11":"lnbc..."}"#.to_owned(),
            "Zap receipt target unavailable",
        ),
    ] {
        let row_text = event_row_text(kind, content)?;
        assert_eq!(row_text, expected);
    }
    Ok(())
}

fn event_row_text(kind: u64, content: String) -> Result<String, String> {
    let window = reduce_feed_window(
        empty_feed_window(1, 10),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![progressive(kind, content)],
            flags: FeedWindowFlags::default(),
        },
    );
    let model = build_feed_view_model(input("feed", window));
    let Some(FeedViewRow::Event(row)) = model.rows.first() else {
        return Err("missing event row".to_owned());
    };
    let FeedEventContent::Rows(rows) = &row.content else {
        return Err("unexpected sensitive row".to_owned());
    };
    Ok(rows
        .first()
        .map(|row| row.text().to_owned())
        .unwrap_or_default())
}

fn input(feed_id: &str, window: lkjstr_app::FeedWindowState) -> FeedViewModelInput {
    let footer = footer_row_from_window(feed_id, &window);
    FeedViewModelInput {
        feed_id: feed_id.to_owned(),
        display_context: EventDisplayContext::Timeline,
        window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        state_rows: Vec::<FeedStateRow>::new(),
        footer,
    }
}

fn progressive(kind: u64, content: String) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://relay.example".to_owned()],
        sub_id: "sub-a".to_owned(),
        event: NostrEvent {
            id: "1".repeat(64),
            pubkey: "a".repeat(64),
            created_at: 1,
            kind,
            tags: Vec::new(),
            content,
            sig: "b".repeat(128),
        },
    }
}
