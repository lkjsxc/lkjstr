use lkjstr_core::actions::{NoteAction, compose_tags, note_action};
use lkjstr_core::pagination::Page;
use lkjstr_protocol::NostrEvent;

#[test]
fn modified_note_keys_cannot_publish_or_navigate() {
    for key in ["l", "r", "p", "o", "Enter"] {
        assert_eq!(note_action(key, true), None);
        assert!(note_action(key, false).is_some());
    }
    assert_eq!(note_action("l", false), Some(NoteAction::Like));
}

#[test]
fn missing_reply_parent_cannot_become_top_level() {
    assert!(compose_tags(Some("missing"), None).is_err());
    assert_eq!(compose_tags(None, None), Ok(vec![]));
    let parent = NostrEvent {
        id: "a".repeat(64),
        pubkey: "b".repeat(64),
        kind: 1,
        created_at: 1,
        tags: vec![],
        content: "parent".into(),
        sig: String::new(),
    };
    assert!(compose_tags(Some("wrong"), Some(&parent)).is_err());
    let tags = compose_tags(Some(&parent.id), Some(&parent));
    assert!(tags.is_ok_and(|tags| {
        tags.iter()
            .any(|t| t.first().is_some_and(|v| v == "e") && t.get(1) == Some(&parent.id))
    }));
}

#[test]
fn noise_does_not_block_pagination_and_short_viewports_need_no_scroll() {
    let raw = Page {
        count: 40,
        oldest: Some(100),
        at_oldest: 1,
    };
    // 34 rendered rows and a short viewport still need the next raw page.
    assert_eq!(raw.next(40, None, true, true, 6000), Some((100, 41)));
    assert_eq!(raw.next(40, None, false, true, 6000), None);
    assert_eq!(raw.next(80, Some(100), true, true, 6000), None);
    assert_eq!(
        Page {
            count: 80,
            oldest: Some(60),
            at_oldest: 1,
        }
        .next(80, Some(100), true, true, 6000),
        Some((60, 41))
    );
    let tied = Page {
        count: 80,
        oldest: Some(100),
        at_oldest: 80,
    };
    assert_eq!(tied.next(80, Some(100), true, true, 6000), Some((100, 120)));
    assert_eq!(
        tied.next(120, Some(100), true, true, 6000),
        None,
        "wait for new rows"
    );
    assert_eq!(
        raw.next(40, None, true, true, 40),
        None,
        "bound query growth"
    );
}
