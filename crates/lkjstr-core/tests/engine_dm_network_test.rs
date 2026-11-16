#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::{RELAY, event};
use lkjstr_core::engine::{
    Engine, dm,
    network::{Effect, Network},
    protocol::Query,
};
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
fn frames(n: &mut Network) -> Vec<Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|f| match f {
            Effect::Send(_, text) => {
                let v: Value = serde_json::from_str(&text).expect("frame");
                (v[0] == "REQ").then_some(v)
            }
            _ => None,
        })
        .collect()
}
fn deliver(n: &mut Network, req: &Value, event: &lkjstr_protocol::NostrEvent, now: u64) {
    let received = n
        .message(RELAY, &json!(["EVENT", req[1], event]).to_string(), now)
        .expect("event matches request");
    n.event(RELAY, &received, now);
}
#[test]
fn reconnect_keeps_two_days_of_randomized_gift_wrap_timestamps() {
    let account = "11".repeat(32);
    let mut n = Network::default();
    n.configure(vec![RELAY.into()], 1_000_010_000);
    let filter = dm::routing::inbox_filter(&account, None);
    n.plan(
        vec![(format!("~dm:{account}"), filter, Query::default())],
        &lkjstr_core::store::Store::new(0),
        1_000_010_000,
    );
    n.connected(RELAY, 1_000_010_010);
    let head = frames(&mut n).remove(0);
    let previous = event(
        1_000_000,
        1059,
        "encrypted previous",
        vec![vec!["p".into(), account.clone()]],
    );
    deliver(&mut n, &head, &previous, 1_000_010_020);
    n.message(RELAY, &json!(["EOSE", head[1]]).to_string(), 1_000_010_021);
    n.disconnected(RELAY, 1_000_010_030);
    n.connected(RELAY, 1_000_011_000);
    let resumed = frames(&mut n)
        .into_iter()
        .find(|r| r[2]["kinds"][0] == 1059)
        .expect("resumed inbox");
    let since = resumed[2]["since"].as_u64().expect("reconnect lower bound");
    let newly_created = 1_000_030 - 172_799;
    assert!(
        since <= newly_created,
        "a new wrap with the maximum timestamp randomization must remain inside the replay window"
    );
    let incoming = event(
        newly_created,
        1059,
        "encrypted new",
        vec![vec!["p".into(), account]],
    );
    let wire_filter: NostrFilter =
        lkjstr_protocol::parse_filter_value(&resumed[2]).expect("filter");
    assert!(lkjstr_protocol::matches_filter(&incoming, &wire_filter));
}
fn inbox_engine() -> (Engine, String) {
    let mut e = Engine::new();
    e.network.configure(vec![RELAY.into()], 0);
    let advertised = event(10, 10050, "", vec![vec!["relay".into(), RELAY.into()]]);
    let account = advertised.pubkey.clone();
    e.enqueue(RELAY.into(), advertised);
    e.tick(1);
    e.set_dm_wants(
        dm::routing::wants(
            &e.store,
            &BTreeSet::from([account.clone()]),
            &BTreeSet::new(),
            &BTreeMap::new(),
        ),
        2,
    );
    (e, account)
}
#[test]
fn private_read_state_distinguishes_empty_success_from_disconnection() {
    let (mut e, a) = inbox_engine();
    assert_eq!(e.dm_phase(&a), ("loading", None));
    e.network.connected(RELAY, 10);
    for now in [1010, 2010, 3010] {
        e.network.tick(now);
    }
    let sent = frames(&mut e.network);
    let req = sent
        .iter()
        .find(|r| r[2]["kinds"][0] == 1059)
        .unwrap_or_else(|| panic!("missing inbox request: {sent:?}"));
    e.network
        .message(RELAY, &json!(["EOSE", req[1]]).to_string(), 3011);
    assert_eq!(e.dm_phase(&a), ("live", None));
    e.network.disconnected(RELAY, 3012);
    assert_eq!(e.dm_phase(&a), ("failed", Some("offline")));
}
#[test]
fn missing_inbox_is_only_declared_after_discovery_completion() {
    let a = "11".repeat(32);
    let mut e = Engine::new();
    assert_eq!(e.dm_phase(&a), ("failed", Some("no-relays")));
    e.network.configure(vec![RELAY.into()], 0);
    e.set_dm_wants(
        vec![(
            format!("~dm-list:{a}"),
            dm::routing::discovery(&a),
            Query::default(),
        )],
        1,
    );
    assert_eq!(e.dm_phase(&a), ("loading", None));
    e.network.connected(RELAY, 10);
    let req = frames(&mut e.network).remove(0);
    e.network
        .message(RELAY, &json!(["EOSE", req[1]]).to_string(), 20);
    assert_eq!(e.dm_phase(&a), ("unsupported", Some("not-found")));
}
#[test]
fn old_full_head_does_not_hide_current_history_exhaustion() {
    let a = "11".repeat(32);
    let mut e = Engine::new();
    e.network.configure(vec![RELAY.into()], 0);
    e.network
        .relay_information(RELAY, r#"{"limitation":{"max_limit":2}}"#);
    let head_filter = dm::routing::inbox_filter(&a, None);
    let sub = format!("~dm:{a}");
    e.set_dm_wants(
        vec![(sub.clone(), head_filter.clone(), Query::default())],
        1,
    );
    e.network.connected(RELAY, 10);
    let head = frames(&mut e.network).remove(0);
    let newest = event(100, 1059, "newer", vec![vec!["p".into(), a.clone()]]);
    let last = event(99, 1059, "older", vec![vec!["p".into(), a.clone()]]);
    deliver(&mut e.network, &head, &newest, 20);
    deliver(&mut e.network, &head, &last, 21);
    e.network
        .message(RELAY, &json!(["EOSE", head[1]]).to_string(), 22);
    let mut cursors = BTreeMap::new();
    assert!(e.dm_history_more(&a, &cursors));
    assert!(e.dm_older(&a, &mut cursors));
    assert_eq!(cursors.get(&(a.clone(), RELAY.into())), Some(&99));
    e.set_dm_wants(
        vec![
            (sub.clone(), head_filter, Query::default()),
            (
                sub,
                dm::routing::inbox_filter(&a, Some(99)),
                Query::default(),
            ),
        ],
        1000,
    );
    e.network.tick(1001);
    let older = frames(&mut e.network)
        .into_iter()
        .find(|r| r[2]["until"] == 99)
        .expect("older page");
    deliver(&mut e.network, &older, &last, 1002);
    e.network
        .message(RELAY, &json!(["EOSE", older[1]]).to_string(), 1003);
    assert!(!e.dm_history_more(&a, &cursors));
    assert!(!e.dm_older(&a, &mut cursors));
}

#[test]
fn reconnect_ignores_future_gift_wraps_when_advancing_the_watermark() {
    let account = "11".repeat(32);
    let now = 1_000_010_000;
    let mut n = Network::default();
    n.configure(vec![RELAY.into()], now);
    n.plan(
        vec![(
            format!("~dm:{account}"),
            dm::routing::inbox_filter(&account, None),
            Query::default(),
        )],
        &lkjstr_core::store::Store::new(0),
        now,
    );
    n.connected(RELAY, now + 10);
    let head = frames(&mut n).remove(0);
    let previous = event(
        1_000_000,
        1059,
        "previous",
        vec![vec!["p".into(), account.clone()]],
    );
    deliver(&mut n, &head, &previous, now + 20);
    n.message(RELAY, &json!(["EOSE", head[1]]).to_string(), now + 21);
    let future = event(
        9_000_000,
        1059,
        "future envelope",
        vec![vec!["p".into(), account]],
    );
    deliver(&mut n, &head, &future, now + 22);
    n.disconnected(RELAY, now + 30);
    n.connected(RELAY, now + 1000);
    let resumed = frames(&mut n).remove(0);
    assert_eq!(resumed[2]["since"].as_u64(), Some(1_000_000 - 172_802));
}
