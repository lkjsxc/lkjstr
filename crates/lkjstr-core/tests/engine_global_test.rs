#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    Engine,
    global::{Held, classify},
    protocol::{Input, Output, Query},
};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};
fn event(content: &str, at: u64) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind: 1,
            content: content.into(),
            tags: vec![],
        },
        &generate_secret_key(),
    )
    .expect("fixture")
}
#[test]
fn burst_copies_are_deterministic_and_short_conversation_is_preserved() {
    let notes = vec![
        event(
            "A thoughtful long message about the future of open networks https://a.test/1",
            1000,
        ),
        event(
            "A thoughtful long message about the future of open networks https://b.test/2!",
            999,
        ),
        event(
            "A thoughtful long message about the future of open networks https://a.test/1",
            200,
        ),
        event("hello", 998),
        event("Hello", 997),
        event("hello", 996),
    ];
    let notes: Vec<_> = notes.into_iter().map(std::sync::Arc::new).collect();
    let expected = vec![
        None,
        Some(Held::Duplicate),
        None,
        None,
        None,
        Some(Held::Duplicate),
    ];
    assert_eq!(classify(&notes), expected);
    assert_eq!(classify(&notes), expected);
}
#[test]
fn lack_of_profile_metadata_does_not_imply_exclusion() {
    let mut notes = vec![];
    for i in 0..5 {
        let mut note = event(&format!("distinct content {i}"), 100 - i);
        note.pubkey = "a".repeat(64);
        notes.push(std::sync::Arc::new(note));
    }
    assert_eq!(
        classify(&notes),
        vec![
            None,
            None,
            None,
            Some(Held::AuthorCap),
            Some(Held::AuthorCap)
        ]
    );
    assert_eq!(classify(&notes[3..]), vec![None, None]);
}
#[test]
fn signed_in_and_other_sources_are_untouched_and_setting_disables_policy() {
    let mut e = Engine::new();
    let first = event("exact duplicate", 100);
    let second = event("exact duplicate", 99);
    e.store.insert(first, None);
    e.store.insert(second, None);
    let open = |e: &mut Engine, sub: &str, query| {
        e.input(
            Input::Open {
                sub: sub.into(),
                query,
            },
            0,
        );
        e.drain()
            .into_iter()
            .find_map(|o| match o {
                Output::Rows { items, .. } => Some(items),
                _ => None,
            })
            .expect("rows")
    };
    let visitor = open(&mut e, "anon", Query::default());
    assert_eq!(visitor.len(), 2);
    assert_eq!(
        visitor[1].hidden_reason,
        Some(lkjstr_core::engine::visibility::Reason::RepeatedContent)
    );
    assert!(visitor[1].content.is_empty());
    assert_eq!(
        open(
            &mut e,
            "signed",
            Query {
                account: Some("f".repeat(64)),
                ..Default::default()
            }
        )
        .iter()
        .filter(|row| row.hidden_reason.is_none())
        .count(),
        2
    );
    e.input(Input::GlobalPolicy { enabled: false }, 1);
    e.drain();
    assert!(
        open(&mut e, "disabled", Query::default())
            .iter()
            .all(|row| row.hidden_reason.is_none())
    );
}
