#![allow(clippy::expect_used)]
#[path = "cache_context/support.rs"]
mod support;
use lkjstr_core::engine::{
    Engine,
    protocol::{Action, Input, Output},
};
use lkjstr_protocol::generate_secret_key;

#[test]
fn serialized_list_edits_preserve_ciphertext_and_monotonic_timestamps() {
    let key = generate_secret_key();
    let target = "a".repeat(64);
    for (kind, action) in [
        (
            3,
            Action::Follow {
                pubkey: target.clone(),
                value: true,
            },
        ),
        (
            10000,
            Action::Mute {
                kind: "person".into(),
                target: target.clone(),
                value: true,
            },
        ),
        (
            10003,
            Action::Bookmark {
                id: target.clone(),
                value: true,
            },
        ),
        (
            10005,
            Action::ChannelJoin {
                id: target.clone(),
                on: true,
            },
        ),
    ] {
        let mut engine = Engine::new();
        let previous = support::event(&key, kind, 100, "opaque encrypted list", vec![]);
        let account = previous.pubkey.clone();
        engine.store.insert(previous, None);
        engine.input(
            Input::Action {
                req: "first".into(),
                account: account.clone(),
                action: action.clone(),
            },
            50000,
        );
        let first = engine
            .drain()
            .into_iter()
            .find_map(|output| match output {
                Output::Sign { event, .. } => Some(event),
                _ => None,
            })
            .expect("first edit reaches signer");
        assert_eq!(first.kind, kind);
        assert_eq!(first.content, "opaque encrypted list");
        assert_eq!(first.created_at, 101);
        assert!(!first.tags.iter().any(|tag| tag[0] == "client"));
        assert!(first.tags.iter().any(|tag| tag.get(1) == Some(&target)));
        engine.input(
            Input::Action {
                req: "second".into(),
                account,
                action,
            },
            50001,
        );
        let second = engine.drain();
        assert!(second.iter().any(
            |output| matches!(output, Output::Error { code, .. } if code == "list-edit-pending")
        ));
        assert!(
            !second
                .iter()
                .any(|output| matches!(output, Output::Sign { .. }))
        );
    }
}

#[test]
fn authored_note_channel_and_article_still_derive_content_tags() {
    let key = generate_secret_key();
    let parent = support::event(&key, 1, 1, "target", vec![]);
    for (kind, output_kind, derives) in [
        ("note", 1, true),
        ("channel", 42, true),
        ("long-form", 30023, true),
        ("reaction", 7, false),
    ] {
        let mut engine = Engine::new();
        engine.store.insert(parent.clone(), None);
        engine.input(
            Input::Action {
                req: kind.into(),
                account: parent.pubkey.clone(),
                action: Action::Publish {
                    kind: kind.into(),
                    content: "#Topic words".into(),
                    target: Some(parent.id.clone()),
                    tags: vec![],
                },
            },
            2000,
        );
        let event = engine
            .drain()
            .into_iter()
            .find_map(|output| match output {
                Output::Sign { event, .. } => Some(event),
                _ => None,
            })
            .expect("authored event");
        assert_eq!(event.kind, output_kind);
        assert_eq!(
            event
                .tags
                .iter()
                .any(|tag| tag.first().is_some_and(|key| key == "t")),
            derives
        );
        assert!(
            event
                .tags
                .iter()
                .any(|tag| tag.first().is_some_and(|key| key == "client"))
        );
    }
}
