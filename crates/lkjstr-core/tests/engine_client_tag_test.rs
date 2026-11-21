#![allow(clippy::expect_used)]
mod engine_review_support;

use engine_review_support::{accept, event, output};
use lkjstr_core::engine::{
    Engine,
    protocol::{self, Action, Input},
    wire,
};
use serde_json::json;

#[test]
fn client_tag_defaults_on_for_every_authored_kind_and_can_be_disabled() {
    let mut e = Engine::new();
    let parent = event(1, 1, "target", vec![]);
    let account = parent.pubkey.clone();
    let id = parent.id.clone();
    e.store.insert(parent, None);
    for kind in ["note", "reply", "quote", "repost", "reaction", "long-form"] {
        e.input(
            Input::Action {
                req: kind.into(),
                account: account.clone(),
                action: Action::Publish {
                    kind: kind.into(),
                    content: "test".into(),
                    target: Some(id.clone()),
                    tags: vec![vec!["client".into(), "forged".into()]],
                },
            },
            2000,
        );
        let signed = e
            .drain()
            .into_iter()
            .find_map(|o| match o {
                protocol::Output::Sign { event, .. } => Some(event),
                _ => None,
            })
            .expect("fixture");
        assert_eq!(
            signed
                .tags
                .iter()
                .filter(|t| t.first().is_some_and(|t| t == "client"))
                .count(),
            1
        );
        assert!(
            signed.tags.contains(
                &[
                    "client",
                    "lkjstr",
                    "31990:160b7d028b99ef2530be8718d03cb0be6f9449fb74d5ae8d6f09a060c63048b1:lkjstr",
                    "wss://relay.ditto.pub/",
                ]
                .map(str::to_owned)
                .into()
            )
        );
    }
    e.client_tag = false;
    e.input(
        Input::Action {
            req: "off".into(),
            account,
            action: Action::Publish {
                kind: "note".into(),
                content: "test".into(),
                target: None,
                tags: vec![vec!["client".into(), "forged".into()]],
            },
        },
        2000,
    );
    assert!(e.drain().iter().any(|o| matches!(o, protocol::Output::Sign { event, .. } if event.tags.iter().all(|t| t[0]!="client"))));
}

#[test]
fn scoped_setting_changes_only_new_requests_by_that_account() {
    let mut engine = Engine::new();
    let first = event(1, 1, "first", vec![]).pubkey;
    let second = event(1, 1, "second", vec![]).pubkey;
    let publish = |engine: &mut Engine, req: &str, account: &str| {
        engine.input(
            Input::Action {
                req: req.into(),
                account: account.into(),
                action: Action::Publish {
                    kind: "note".into(),
                    content: req.into(),
                    target: None,
                    tags: vec![],
                },
            },
            3000,
        );
        engine
            .drain()
            .into_iter()
            .find_map(|output| match output {
                protocol::Output::Sign { event, .. } => Some(event.tags),
                _ => None,
            })
            .expect("signing request")
    };
    let already_requested = publish(&mut engine, "before", &first);
    engine.client_tag_accounts.insert(first.clone(), false);
    assert!(publish(&mut engine, "after", &first).is_empty());
    assert_eq!(publish(&mut engine, "other", &second), already_requested);
    assert_eq!(already_requested.len(), 1);
}

#[test]
fn fresh_note_rows_project_name_independently_of_address() {
    let mut engine = Engine::new();
    let mut session = wire::Session::default();
    let address = format!("31990:{}:App:ID", "a".repeat(64));
    let tagged = |at, tag: Vec<&str>| {
        let tags = if tag.is_empty() {
            vec![]
        } else {
            vec![tag.into_iter().map(String::from).collect()]
        };
        event(at, 1, &format!("look {at}"), tags)
    };
    let cases = [
        (
            tagged(1, vec!["client", "App", &address]),
            Some("App"),
            Some(address.as_str()),
        ),
        (tagged(2, vec!["client", "Plain"]), Some("Plain"), None),
        (
            tagged(3, vec!["client", "Malformed", "1:wrong:d"]),
            Some("Malformed"),
            None,
        ),
        (tagged(4, vec![]), None, None),
    ];
    for (note, _, _) in &cases {
        engine.enqueue("cache".into(), note.clone());
    }
    engine.tick(100);
    for (note, name, address) in cases {
        accept(
            &mut session,
            &mut engine,
            json!({"t":"open","sub":note.id,"query":{"source":"thread","id":note.id}}),
            101,
        );
        let outputs = output(&mut session, &mut engine);
        let row = outputs
            .iter()
            .filter_map(|message| message["rows"].as_array())
            .flatten()
            .find(|row| row["id"] == note.id)
            .expect("projected note");
        assert_eq!(row["client"].as_str(), name);
        assert_eq!(row["clientAddress"].as_str(), address);
    }
}
