#![allow(clippy::expect_used)]
use super::{
    Engine,
    protocol::{Input, Query, Source},
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, UnsignedNostrEvent, finalize_event, generate_secret_key,
};
fn event(kind: u64, tags: Vec<Vec<String>>) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 1,
            kind,
            tags,
            content: "public fixture".into(),
        },
        &generate_secret_key(),
    )
    .expect("signed fixture")
}

#[test]
fn client_tag_selection_keeps_authored_kinds_and_removes_forged_tags() {
    let engine = Engine::new();
    for (kind, expected) in [
        (1, true),
        (6, true),
        (7, true),
        (16, true),
        (40, true),
        (41, true),
        (42, true),
        (30023, true),
        (0, false),
        (3, false),
        (5, false),
        (9735, false),
        (10000, false),
        (30000, false),
        (30311, false),
    ] {
        let mut unsigned = UnsignedNostrEvent {
            pubkey: "a".repeat(64),
            kind,
            created_at: 1,
            content: String::new(),
            tags: vec![vec!["client".into(), "forged".into()]],
        };
        engine.apply_client_tag(&mut unsigned);
        assert_eq!(unsigned.tags.len(), usize::from(expected), "kind {kind}");
        if expected {
            assert_eq!(unsigned.tags[0][1], "lkjstr");
        }
        let mut disabled = Engine::new();
        disabled
            .client_tag_accounts
            .insert(unsigned.pubkey.clone(), false);
        disabled.apply_client_tag(&mut unsigned);
        assert!(unsigned.tags.is_empty(), "account opt-out {kind}");
    }
}

#[test]
fn publication_recipient_selection_stays_bounded_and_ignores_other_faces() {
    let people: Vec<_> = (1..=40).map(|n| format!("{n:064x}")).collect();
    for (kind, expected) in [
        (1, true),
        (6, true),
        (7, true),
        (16, true),
        (42, true),
        (30023, true),
        (0, false),
        (3, false),
        (40, false),
        (41, false),
        (9735, false),
        (10000, false),
        (30000, false),
        (30311, false),
        (4, false),
    ] {
        let mut tags: Vec<_> = people
            .iter()
            .rev()
            .map(|p| vec!["p".into(), p.clone()])
            .collect();
        tags.extend([
            vec!["p".into(), people[0].clone()],
            vec!["p".into(), "invalid".into()],
        ]);
        let event = event(kind, tags);
        let recipients = super::publication_discovery::recipients(&event);
        assert_eq!(
            recipients,
            if expected {
                people[..32].to_vec()
            } else {
                vec![]
            },
            "kind {kind}"
        );
    }
}

#[test]
fn deletion_fences_keep_the_existing_note_channel_article_scope() {
    for (kind, expected) in [
        (1, true),
        (42, true),
        (30023, true),
        (0, false),
        (3, false),
        (6, false),
        (7, false),
        (16, false),
        (9735, false),
        (30311, false),
    ] {
        let mut engine = Engine::new();
        let event = event(kind, vec![]);
        let id = event.id.clone();
        let author = event.pubkey.clone();
        engine.store.insert(event, None);
        engine.input(
            Input::Open {
                sub: "focus".into(),
                query: Query {
                    source: Source::Thread,
                    target: Some(id.clone()),
                    ..Default::default()
                },
            },
            0,
        );
        let view = engine.views.get("focus").expect("view");
        let event = engine.store.get(&id).expect("stored body");
        let filter = super::visibility::deletion_filter(&engine.store, view, &[event], &[None]);
        assert_eq!(filter.is_some(), expected, "kind {kind}");
        if let Some(filter) = filter {
            assert_eq!(filter.kinds, Some(vec![5]));
            assert_eq!(filter.authors, Some(vec![author]));
            assert_eq!(filter.tags.get("e"), Some(&vec![id]));
        }
    }
}
