use lkjstr_domain::empty_tweet_draft;
use lkjstr_storage::{tweet_draft_record_id, tweet_draft_record_json_bytes};

#[test]
fn tweet_draft_rows_keep_identity_and_json_shape() {
    let row = empty_tweet_draft("tab:tweet", 99);
    assert_eq!(tweet_draft_record_id(&row), "tab:tweet");
    let bytes = tweet_draft_record_json_bytes(&row).map_or(0, |size| size);
    assert!(bytes > 40);
}
