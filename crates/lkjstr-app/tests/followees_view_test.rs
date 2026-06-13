use lkjstr_app::{
    FolloweesStatus, TargetFollowListState, followees_retryable_failure_view,
    followees_view_from_summary, summarize_follow_list,
};
use lkjstr_protocol::{KIND_FOLLOW_LIST, NostrEvent};

#[test]
fn followees_view_uses_real_deduped_nip02_entries() {
    let event = event(vec![
        vec![
            "p".to_owned(),
            pubkey("b"),
            "relay.example".to_owned(),
            "best friend".to_owned(),
        ],
        vec!["p".to_owned(), "bad".to_owned()],
        vec!["p".to_owned(), pubkey("b")],
        vec!["p".to_owned(), pubkey("c")],
    ]);
    let view = followees_view_from_summary(
        "followees-tab",
        Some(pubkey("a")),
        TargetFollowListState::Found,
        summarize_follow_list(&event),
    );

    assert_eq!(view.status, FolloweesStatus::Ready);
    assert_eq!(view.following_count, 2);
    assert_eq!(view.rows[0].row_id, format!("followee:{}", pubkey("b")));
    assert_eq!(view.rows[0].relay.as_deref(), Some("wss://relay.example/"));
    assert_eq!(view.rows[0].petname.as_deref(), Some("best friend"));
}

#[test]
fn followees_view_does_not_claim_absence_before_proof() {
    let view = lkjstr_app::default_followees_view("followees-tab", Some(pubkey("a")));

    assert_eq!(view.status, FolloweesStatus::Loading);
    assert_eq!(view.message, "Loading following list...");
    assert!(view.rows.is_empty());
}

#[test]
fn followees_view_names_missing_target_explicitly() {
    let view = lkjstr_app::default_followees_view("followees-tab", None);

    assert_eq!(view.status, FolloweesStatus::MissingPubkey);
    assert_eq!(view.message, "Followees target unavailable.");
}

#[test]
fn followees_retryable_failure_names_attempted_selected_relay() {
    let view = followees_retryable_failure_view(
        "followees-tab",
        Some(pubkey("a")),
        &["wss://selected.example".to_owned()],
    );

    assert_eq!(view.status, FolloweesStatus::PartialFailure);
    assert_eq!(view.following_count, 0);
    assert!(view.rows.is_empty());
    assert!(view.message.contains("Retry available"));
    assert_eq!(view.diagnostics.len(), 1);
    assert_eq!(
        view.diagnostics[0].relay.as_deref(),
        Some("wss://selected.example")
    );
    assert!(view.diagnostics[0].retry_available);
}

fn event(tags: Vec<Vec<String>>) -> NostrEvent {
    NostrEvent {
        id: "d".repeat(64),
        pubkey: pubkey("a"),
        created_at: 1,
        kind: KIND_FOLLOW_LIST,
        tags,
        content: String::new(),
        sig: "e".repeat(128),
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
