#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    dm,
    network::{Effect, Network},
    protocol::Query,
};
use lkjstr_core::store::Store;
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
use std::collections::BTreeSet;
const RELAY: &str = "wss://local.test/";
#[test]
fn private_inboxes_legacy_and_lists_share_a_single_relay_slot() {
    let mut n = Network::default();
    n.configure(vec![RELAY.into()], 0);
    n.relay_information(
        RELAY,
        r#"{"limitation":{"max_subscriptions":1,"max_filters":1}}"#,
    );
    let accounts = ["11".repeat(32), "22".repeat(32), "33".repeat(32)];
    let mut wants = Vec::new();
    for a in &accounts {
        wants.push((
            format!("~dm:{a}"),
            dm::routing::inbox_filter(a, None),
            Query::default(),
        ));
    }
    let a = &accounts[0];
    wants.push((
        format!("~dm-list:{a}"),
        dm::routing::discovery(a),
        Query::default(),
    ));
    wants.push((
        format!("~dm-legacy:{a}"),
        NostrFilter {
            kinds: Some(vec![4]),
            authors: Some(vec![a.clone()]),
            limit: Some(200),
            ..Default::default()
        },
        Query::default(),
    ));
    wants.push((
        format!("~dm-legacy:{a}"),
        NostrFilter {
            kinds: Some(vec![4]),
            tags: std::collections::BTreeMap::from([("p".into(), vec![a.clone()])]),
            limit: Some(200),
            ..Default::default()
        },
        Query::default(),
    ));
    let expected = wants.len();
    n.plan(wants, &Store::new(0), 0);
    n.connected(RELAY, 10);
    let mut seen = BTreeSet::new();
    for now in (20..20_000).step_by(100) {
        for effect in n.drain_effects() {
            if let Effect::Send(_, text) = effect {
                let frame: Value = serde_json::from_str(&text).expect("frame");
                if frame[0] == "REQ" {
                    seen.insert(frame[2].to_string());
                    n.message(RELAY, &json!(["EOSE", frame[1]]).to_string(), now);
                }
            }
        }
        n.tick(now + 1);
        if seen.len() == expected {
            break;
        }
    }
    assert_eq!(
        seen.len(),
        expected,
        "every visible private request must get a slot after older requests answer"
    );
    n.plan(vec![], &Store::new(0), 21_000);
    assert!(
        n.open_wires().is_empty(),
        "closing private views releases their relay work"
    );
}
