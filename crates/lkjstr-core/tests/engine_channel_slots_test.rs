#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    network::{Effect, Network},
    protocol::{Query, Source},
};
use lkjstr_protocol::{NostrFilter, parse_filter_value};
use serde_json::{Value, json};
#[test]
fn joined_list_and_multiple_channels_rotate_on_one_slot_and_release_on_close() {
    let relay = "wss://local.test/";
    let mut network = Network::default();
    network.configure(vec![relay.into()], 0);
    network.relay_information(relay, r#"{"limitation":{"max_subscriptions":1}}"#);
    let mut wants = vec![(
        "list".into(),
        NostrFilter {
            kinds: Some(vec![10005]),
            authors: Some(vec!["a".repeat(64)]),
            limit: Some(1),
            ..Default::default()
        },
        Query {
            source: Source::Channels,
            ..Default::default()
        },
    )];
    for i in 0..3 {
        let mut filter = NostrFilter {
            kinds: Some(vec![42]),
            limit: Some(200),
            ..Default::default()
        };
        filter.tags.insert("e".into(), vec![format!("{i:064x}")]);
        wants.push((
            format!("channel-{i}"),
            filter,
            Query {
                source: Source::Channel,
                ..Default::default()
            },
        ));
    }
    network.plan(wants, 0);
    network.connected(relay, 1);
    let mut served = std::collections::BTreeSet::new();
    for now in (100..=4000).step_by(100) {
        for effect in network.drain_effects() {
            if let Effect::Send(_, text) = effect {
                let frame: Value = serde_json::from_str(&text).expect("frame");
                if frame[0] != "REQ" {
                    continue;
                }
                let filter = parse_filter_value(&frame[2]).expect("filter");
                served.insert(frame[2].to_string());
                network.message(relay, &json!(["EOSE", frame[1]]).to_string(), now);
                assert!(filter.kinds.is_some());
            }
        }
        network.tick(now);
    }
    assert_eq!(
        served.len(),
        4,
        "every channel and the joined list must be served"
    );
    assert!(
        network.list_loaded(
            &lkjstr_core::store::Store::with_caps(20, 20),
            &"a".repeat(64),
            10005
        ),
        "a paused successful empty joined-list lookup remains usable"
    );
    network.plan(vec![], 4100);
    assert!(
        network
            .drain_effects()
            .iter()
            .any(|e| matches!(e,Effect::Disconnect(url) if url==relay))
    );
}
