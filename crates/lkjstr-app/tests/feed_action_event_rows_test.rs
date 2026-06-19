use lkjstr_app::feed::FeedEventContent;
use lkjstr_app::{
    EventDisplayContext, FeedFragmentConfig, FeedStateRow, FeedViewModelInput, FeedViewRow,
    FeedWindowEvidence, FeedWindowFlags, RowGeometryModel, build_feed_view_model,
    empty_feed_window, footer_row_from_window, reduce_feed_window,
};
use lkjstr_protocol::{
    EventTemplate, KIND_GENERIC_REPOST, KIND_REACTION, KIND_REPOST, KIND_TEXT_NOTE,
    KIND_ZAP_RECEIPT, NostrEvent, finalize_event, parse_secret_key_hex,
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

#[test]
fn feed_view_model_renders_verified_nested_repost_target() -> Result<(), String> {
    let target = signed_target_event()?;
    let repost_content = serde_json::to_string(&target).map_err(|error| error.to_string())?;
    let row = event_row(KIND_REPOST, repost_content, vec![e_tag(&target.id)])?;
    let FeedEventContent::Rows(rows) = row.content else {
        return Err("unexpected sensitive repost row".to_owned());
    };
    let nested = rows.iter().find_map(|row| match row {
        lkjstr_app::feed::FeedEventContentRow::RepostTarget(target) => Some(target),
        _ => None,
    });
    let Some(nested) = nested else {
        return Err("missing nested repost target row".to_owned());
    };

    assert_eq!(nested.event_id, target.id);
    assert_eq!(
        nested.display.geometry_context,
        "shared-event:repost-target"
    );
    assert!(!nested.display.chrome.show_actions);
    assert_eq!(nested.geometry_estimate.key, nested.row_key);
    assert_eq!(nested.content.texts(), vec!["nested target".to_owned()]);
    Ok(())
}

#[test]
fn feed_view_model_rejects_unverified_nested_repost_target() -> Result<(), String> {
    let mut target = signed_target_event()?;
    target.content = "changed".to_owned();
    let repost_content = serde_json::to_string(&target).map_err(|error| error.to_string())?;
    let row = event_row(KIND_REPOST, repost_content, vec![e_tag(&target.id)])?;
    assert_repost_target_rejected(row)?;

    let target = signed_target_event()?;
    let repost_content = serde_json::to_string(&target).map_err(|error| error.to_string())?;
    let row = event_row(KIND_REPOST, repost_content, vec![e_tag(&"4".repeat(64))])?;
    assert_repost_target_rejected(row)?;
    Ok(())
}

fn assert_repost_target_rejected(row: lkjstr_app::FeedEventRow) -> Result<(), String> {
    let FeedEventContent::Rows(rows) = row.content else {
        return Err("unexpected sensitive repost row".to_owned());
    };
    assert_eq!(
        rows.first()
            .map(lkjstr_app::feed::FeedEventContentRow::text),
        Some("Reposted target unavailable".to_owned())
    );
    assert!(
        !rows
            .iter()
            .any(|row| matches!(row, lkjstr_app::feed::FeedEventContentRow::RepostTarget(_)))
    );
    Ok(())
}

fn event_row_text(kind: u64, content: String) -> Result<String, String> {
    let row = event_row(kind, content, Vec::new())?;
    let FeedEventContent::Rows(rows) = &row.content else {
        return Err("unexpected sensitive row".to_owned());
    };
    Ok(rows
        .first()
        .map_or_else(String::new, lkjstr_app::feed::FeedEventContentRow::text))
}

fn event_row(
    kind: u64,
    content: String,
    tags: Vec<Vec<String>>,
) -> Result<lkjstr_app::FeedEventRow, String> {
    let window = reduce_feed_window(
        empty_feed_window(1, 10),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![progressive(kind, content, tags)],
            flags: FeedWindowFlags::default(),
        },
    );
    let model = build_feed_view_model(input("feed", window));
    let Some(FeedViewRow::Event(row)) = model.rows.first() else {
        return Err("missing event row".to_owned());
    };
    Ok(row.clone())
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

fn progressive(kind: u64, content: String, tags: Vec<Vec<String>>) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://relay.example".to_owned()],
        sub_id: "sub-a".to_owned(),
        event: NostrEvent {
            id: "1".repeat(64),
            pubkey: "a".repeat(64),
            created_at: 1,
            kind,
            tags,
            content,
            sig: "b".repeat(128),
        },
    }
}

fn signed_target_event() -> Result<NostrEvent, String> {
    let secret =
        parse_secret_key_hex(&"01".repeat(32)).ok_or_else(|| "secret should parse".to_owned())?;
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 2,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: "nested target".to_owned(),
        },
        &secret,
    )
    .map_err(|error| format!("{error:?}"))
}

fn e_tag(id: &str) -> Vec<String> {
    vec!["e".to_owned(), id.to_owned()]
}

trait ContentTexts {
    fn texts(&self) -> Vec<String>;
}

impl ContentTexts for FeedEventContent {
    fn texts(&self) -> Vec<String> {
        match self {
            FeedEventContent::Sensitive { rows, .. } | FeedEventContent::Rows(rows) => {
                rows.iter().map(|row| row.text()).collect()
            }
        }
    }
}
