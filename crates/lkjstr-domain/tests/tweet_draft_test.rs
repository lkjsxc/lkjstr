use lkjstr_domain::{
    create_tweet_draft, empty_tweet_draft, tweet_draft_has_body, tweet_draft_id_for_tab,
};

#[test]
fn tweet_draft_rows_use_tab_scoped_ids() {
    let draft = empty_tweet_draft(tweet_draft_id_for_tab("compose"), 42);
    assert_eq!(draft.id, "tab:compose");
    assert_eq!(draft.updated_at, 42);
    assert!(!tweet_draft_has_body(&draft));
}

#[test]
fn tweet_draft_body_includes_attachments_and_warning_state() {
    let mut draft = create_tweet_draft("main", Some("acct".to_owned()), "hello", 7);
    draft.sensitive = true;
    draft.content_warning_reason = "spoiler".to_owned();
    assert_eq!(draft.account_id.as_deref(), Some("acct"));
    assert_eq!(draft.content_warning_reason, "spoiler");
    assert!(draft.sensitive);
    assert!(tweet_draft_has_body(&draft));
}
