use lkjstr_protocol::{
    NostrEvent, content_warning_reason, content_warning_tag, has_content_warning,
};

#[test]
fn reads_content_warning_reason() {
    let event = event_with_tags(vec![vec![
        "content-warning".to_owned(),
        "  spoiler  ".to_owned(),
    ]]);
    assert_eq!(content_warning_reason(&event), Some("spoiler".to_owned()));
    assert!(has_content_warning(&event));
}

#[test]
fn distinguishes_absent_warning_from_empty_reason() {
    assert_eq!(content_warning_reason(&event_with_tags(Vec::new())), None);
    assert_eq!(
        content_warning_reason(&event_with_tags(vec![vec!["content-warning".to_owned()]])),
        Some(String::new())
    );
}

#[test]
fn builds_trimmed_content_warning_tags() {
    assert_eq!(
        content_warning_tag(" spoiler "),
        vec!["content-warning".to_owned(), "spoiler".to_owned()]
    );
    assert_eq!(
        content_warning_tag("  "),
        vec!["content-warning".to_owned()]
    );
}

fn event_with_tags(tags: Vec<Vec<String>>) -> NostrEvent {
    NostrEvent {
        id: "0".repeat(64),
        pubkey: "1".repeat(64),
        created_at: 1,
        kind: 1,
        tags,
        content: String::new(),
        sig: "2".repeat(128),
    }
}
