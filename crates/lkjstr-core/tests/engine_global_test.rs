#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        Engine,
        global::{Held, classify},
        protocol::{Input, Output, Query},
    },
    store::Store,
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
    let store = Store::new(100);
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
    assert_eq!(classify(&store, &notes, |_| false), expected);
    assert_eq!(classify(&store, &notes, |_| false), expected);
}
#[test]
fn profile_absence_only_applies_after_lookup_and_author_cap_is_per_window() {
    let store = Store::new(100);
    let mut notes = vec![];
    for i in 0..5 {
        let mut note = event(&format!("distinct content {i}"), 100 - i);
        note.pubkey = "a".repeat(64);
        notes.push(std::sync::Arc::new(note));
    }
    assert_eq!(
        classify(&store, &notes, |_| false),
        vec![
            None,
            None,
            None,
            Some(Held::AuthorCap),
            Some(Held::AuthorCap)
        ]
    );
    assert_eq!(
        classify(&store, &notes, |_| true),
        vec![Some(Held::NoProfile); 5]
    );
    assert_eq!(classify(&store, &notes[3..], |_| false), vec![None, None]);
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
                Output::Rows { items, .. } => Some(items.len()),
                _ => None,
            })
            .expect("rows")
    };
    assert_eq!(open(&mut e, "anon", Query::default()), 1);
    assert_eq!(
        open(
            &mut e,
            "signed",
            Query {
                account: Some("f".repeat(64)),
                ..Default::default()
            }
        ),
        2
    );
    e.input(Input::GlobalPolicy { enabled: false }, 1);
    e.drain();
    assert_eq!(open(&mut e, "disabled", Query::default()), 2);
}
