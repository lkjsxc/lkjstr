#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    Engine,
    protocol::{Action, Input, Output},
};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, parse_secret_key_hex};
fn event(seed: u8, kind: u64, tags: Vec<Vec<String>>) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 1,
            kind,
            tags,
            content: String::new(),
        },
        &parse_secret_key_hex(&format!("{seed:02x}").repeat(32)).expect("fixture"),
    )
    .expect("event")
}
fn publish(e: &mut Engine, action: Action, at: u64) -> String {
    let owner = event(1, 1, vec![]).pubkey;
    e.input(
        Input::Action {
            req: at.to_string(),
            account: owner,
            action,
        },
        at,
    );
    let unsigned = e
        .drain()
        .into_iter()
        .find_map(|o| match o {
            Output::Sign { event, .. } => Some(event),
            _ => None,
        })
        .expect("sign");
    let event = finalize_event(
        &EventTemplate {
            pubkey: Some(unsigned.pubkey),
            created_at: unsigned.created_at,
            kind: unsigned.kind,
            tags: unsigned.tags,
            content: unsigned.content,
        },
        &parse_secret_key_hex(&"01".repeat(32)).expect("fixture"),
    )
    .expect("signed");
    let id = event.id.clone();
    e.input(
        Input::Signed {
            req: at.to_string(),
            event: Some(event),
            error: None,
        },
        at + 1,
    );
    id
}
fn write_list(seed: u8, n: usize) -> NostrEvent {
    event(
        seed,
        10002,
        (0..n)
            .map(|i| vec!["r".into(), format!("wss://own{i}.test"), "write".into()])
            .collect(),
    )
}
#[test]
fn replies_use_author_write_recipient_read_and_parent_origin() {
    let mut e = Engine::new();
    e.store.insert(write_list(1, 14), None);
    let inbox = event(
        2,
        10002,
        vec![
            vec!["r".into(), "wss://inbox.test".into(), "read".into()],
            vec![
                "r".into(),
                "wss://recipient-write.test".into(),
                "write".into(),
            ],
        ],
    );
    let parent = event(2, 1, vec![]);
    let target = parent.id.clone();
    e.store.insert(inbox, None);
    e.store.insert(parent, Some("wss://origin.test/"));
    publish(
        &mut e,
        Action::Publish {
            kind: "reply".into(),
            content: "reply".into(),
            target: Some(target),
            tags: vec![],
        },
        100000,
    );
    let stats = e.network.recent_publications();
    let ds = stats[0]["deliveries"].as_array().expect("deliveries");
    assert_eq!(ds.iter().filter(|d| d["state"] == "pending").count(), 14);
    assert_eq!(ds.iter().filter(|d| d["reason"] == "own-cap").count(), 2);
    assert!(ds.iter().any(|d| d["url"] == "wss://inbox.test/"));
    assert!(ds.iter().any(|d| d["url"] == "wss://origin.test/"));
    assert!(!ds.iter().any(|d| d["url"] == "wss://recipient-write.test/"));
}
#[test]
fn delete_retains_original_destinations_after_reload_and_list_change() {
    let mut e = Engine::new();
    e.store.insert(write_list(1, 12), None);
    let id = publish(
        &mut e,
        Action::Publish {
            kind: "note".into(),
            content: "original".into(),
            target: None,
            tags: vec![],
        },
        100000,
    );
    let original = e.store.get(&id).expect("note");
    let routes = e.network.publication_routes_json();
    let mut next = Engine::new();
    next.network.restore_publication_routes(&routes);
    next.store.insert((*original).clone(), None);
    next.store.insert(
        event(1, 10002, vec![vec!["r".into(), "wss://new.test".into()]]),
        None,
    );
    publish(
        &mut next,
        Action::Publish {
            kind: "delete".into(),
            content: String::new(),
            target: Some(id),
            tags: vec![],
        },
        101000,
    );
    let stats = next.network.recent_publications();
    let ds = stats[0]["deliveries"].as_array().expect("deliveries");
    assert_eq!(ds.len(), 13);
    assert_eq!(ds.iter().filter(|d| d["rule"] == "delete").count(), 12);
}
#[test]
fn mute_list_does_not_notify_every_muted_person() {
    let mut e = Engine::new();
    e.store.insert(write_list(1, 1), None);
    let person = event(2, 1, vec![]).pubkey;
    e.store.insert(event(1, 10000, vec![]), None);
    e.store.insert(
        event(
            2,
            10002,
            vec![vec!["r".into(), "wss://inbox.test".into(), "read".into()]],
        ),
        None,
    );
    publish(
        &mut e,
        Action::Mute {
            kind: "person".into(),
            target: person,
            value: true,
        },
        100000,
    );
    assert_eq!(
        e.network.recent_publications()[0]["deliveries"]
            .as_array()
            .expect("deliveries")
            .len(),
        1
    );
    assert!(!e.network.relays.contains_key("wss://inbox.test/"));
}

#[test]
fn relay_list_transition_reaches_both_new_and_previous_outboxes() {
    let mut e = Engine::new();
    e.store.insert(write_list(1, 2), None);
    publish(
        &mut e,
        Action::RelaysSave {
            relays: vec![
                lkjstr_core::engine::protocol::RelayEntry {
                    url: "wss://new.test".into(),
                    read: true,
                    write: true,
                },
                lkjstr_core::engine::protocol::RelayEntry {
                    url: "wss://read-only.test".into(),
                    read: true,
                    write: false,
                },
            ],
        },
        100000,
    );
    let stats = e.network.recent_publications();
    let ds = stats[0]["deliveries"].as_array().expect("deliveries");
    assert_eq!(ds.len(), 3);
    assert!(ds.iter().all(|d| d["state"] == "pending"));
    assert!(ds.iter().any(|d| d["url"] == "wss://new.test/"));
    assert!(ds.iter().any(|d| d["url"] == "wss://own0.test/"));
    assert!(ds.iter().any(|d| d["url"] == "wss://own1.test/"));
}

#[test]
fn first_relay_list_update_reaches_previous_bootstrap() {
    let mut e = Engine::new();
    e.configure_relays(
        vec![lkjstr_core::engine::wire::RelayConfig {
            url: "wss://bootstrap.test/".into(),
            read: true,
            write: true,
            search: false,
        }],
        0,
    )
    .expect("config");
    publish(
        &mut e,
        Action::RelaysSave {
            relays: vec![lkjstr_core::engine::protocol::RelayEntry {
                url: "wss://new.test/".into(),
                read: true,
                write: true,
            }],
        },
        100000,
    );
    let stats = e.network.recent_publications();
    let ds = stats[0]["deliveries"].as_array().expect("deliveries");
    assert!(ds.iter().any(|d| d["url"] == "wss://bootstrap.test/"));
    assert!(ds.iter().any(|d| d["url"] == "wss://new.test/"));
}
