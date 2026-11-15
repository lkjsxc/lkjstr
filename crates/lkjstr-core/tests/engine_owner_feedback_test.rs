#![allow(clippy::expect_used)]
//! Owner feedback policy regressions; all events and effects stay local.
mod engine_review_support;
use engine_review_support::{accept, event, frames, output};
use lkjstr_core::engine::{
    Engine,
    protocol::{self, Action, Input},
    wire,
};
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};
use serde_json::json;

#[test]
fn discovery_is_independent_of_views_and_retains_indexers() {
    let mut e = Engine::new();
    e.configure_relays(
        vec![wire::RelayConfig {
            url: "wss://index.test/".into(),
            read: true,
            write: true,
            search: false,
        }],
        0,
    )
    .expect("fixture");
    let account = event(1, 1, "owner", vec![]).pubkey;
    e.discover_account(
        Some(account.clone()),
        vec!["wss://index.test/".into(), "wss://hint.test/".into()],
        0,
    );
    e.network.connected("wss://index.test/", 1);
    assert!(frames(&mut e).iter().any(|f| {
        f[0] == "REQ"
            && f[2]["authors"] == json!([account])
            && f[2]["kinds"]
                .as_array()
                .is_some_and(|kinds| kinds.len() == 1)
    }));
    e.configure_relays(
        vec![wire::RelayConfig {
            url: "wss://owner.test/".into(),
            read: true,
            write: false,
            search: false,
        }],
        2,
    )
    .expect("fixture");
    assert!(e.network.relays.contains_key("wss://index.test/"));
    assert!(!e.network.known["wss://index.test/"].write);
    e.input(
        Input::Hint {
            focused_sub: None,
            visible_subs: vec![],
            page_hidden: true,
            idle: false,
            save_data: false,
        },
        3,
    );
    assert!(frames(&mut e).iter().any(|f| f[0] == "CLOSE"));
}

#[test]
fn latest_nip65_overrides_legacy_even_when_empty() {
    let key = generate_secret_key();
    let sign = |at, kind, content: &str, tags| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: at,
                kind,
                content: content.into(),
                tags,
            },
            &key,
        )
        .expect("fixture")
    };
    let legacy = sign(
        1,
        3,
        r#"{"wss://legacy.test":{"read":true,"write":false},"https://bad.test":{}}"#,
        vec![],
    );
    let owner = legacy.pubkey.clone();
    let mut e = Engine::new();
    e.enqueue("cache".into(), legacy);
    e.tick(0);
    let (_, relays) = e.account_relays(&owner).expect("fixture");
    assert_eq!(relays.len(), 1);
    assert!(relays[0].read && !relays[0].write);
    e.input(
        Input::Action {
            req: "legacy-follow".into(),
            account: owner.clone(),
            action: Action::Follow {
                pubkey: owner.clone(),
                value: false,
            },
        },
        1000,
    );
    assert!(e.drain().iter().any(|o|matches!(o, protocol::Output::Sign { event, .. } if event.kind==3 && event.content.contains("legacy.test"))));
    let list = sign(
        2,
        10002,
        "",
        vec![vec!["r".into(), "wss://owner.test".into(), "write".into()]],
    );
    e.enqueue("cache".into(), list);
    e.tick(1);
    assert_eq!(
        e.account_relays(&owner).expect("fixture").1[0].url,
        "wss://owner.test/"
    );
    e.enqueue("cache".into(), sign(3, 10002, "", vec![]));
    e.tick(2);
    assert!(e.account_relays(&owner).expect("fixture").1.is_empty());
}

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
                    tags: vec![],
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
            signed
                .tags
                .contains(&vec!["client".into(), "lkjstr".into()])
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
                tags: vec![],
            },
        },
        2000,
    );
    assert!(e.drain().iter().any(|o| matches!(o, protocol::Output::Sign { event, .. } if event.tags.iter().all(|t| t[0]!="client"))));
}

#[test]
fn blossom_defaults_do_not_override_an_explicit_server_list() {
    let mut e = Engine::new();
    let empty = event(1, 10063, "", vec![]);
    assert_eq!(e.upload_servers(&empty.pubkey).len(), 3);
    let account = empty.pubkey.clone();
    e.store.insert(empty, None);
    assert!(e.upload_servers(&account).is_empty());
    assert_eq!(e.stats()["totals"]["eventsStored"], 1);
}

#[test]
fn retained_windows_and_time_lookup_preserve_5000_rows() {
    let mut e = Engine::new();
    e.signed_out_global_filter = false;
    // Store is exercised here; real signature ingestion is covered by conformance.
    let template = event(1, 1, "row", vec![]);
    for i in 0..5000 {
        let mut row = template.clone();
        row.id = format!("{i:064x}");
        row.created_at = 1000 + i / 4;
        e.store.insert(row, None);
    }
    let mut s = wire::Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"global"}}),
        0,
    );
    output(&mut s, &mut e);
    let mut ids = vec![];
    for _ in 0..30 {
        accept(
            &mut s,
            &mut e,
            json!({"t":"window","sub":"feed","anchor":ids.last().map(|id|json!({"key":id})).unwrap_or(json!("top")),"before":0,"after":200,"retainAbove":true}),
            1,
        );
        let rows = output(&mut s, &mut e)
            .into_iter()
            .find(|v| v["t"] == "rows")
            .expect("fixture");
        let next = rows["rows"]
            .as_array()
            .expect("fixture")
            .iter()
            .map(|r| r["key"].as_str().expect("fixture").to_owned())
            .collect::<Vec<_>>();
        assert!(next.starts_with(&ids));
        ids = next;
        if ids.len() == 5000 {
            break;
        }
    }
    assert_eq!(ids.len(), 5000);
    assert_eq!(
        ids.iter().collect::<std::collections::BTreeSet<_>>().len(),
        5000
    );
    assert!(ids.windows(2).all(|w| w[0] > w[1]));
    let lookup = serde_json::to_value(s.row_at_time("time".into(), "feed".into(), 1_500_000, &e))
        .expect("fixture");
    assert_eq!(lookup["at"], 1_500_000);
    let key = lookup["key"].as_str().expect("fixture");
    assert_eq!(key, format!("{:064x}", 2003));
}
