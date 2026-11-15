#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{RELAY, accept, event, frames, output};
use lkjstr_core::engine::{Engine, protocol, wire};
use lkjstr_protocol::{
    EventTemplate, finalize_event, generate_secret_key, matches_filter, parse_filter_value,
};
use serde_json::{Value, json};
#[test]
fn channel_pages_through_fake_relay_timestamp_ties_without_gaps_or_duplicate_keys() {
    let key = generate_secret_key();
    let channel = event(1, 40, r#"{"name":"Paging"}"#, vec![]);
    let mut fixtures = (0..230)
        .map(|i| {
            finalize_event(
                &EventTemplate {
                    pubkey: None,
                    created_at: 100 + i / 3,
                    kind: 42,
                    content: format!("row {i}"),
                    tags: vec![vec![
                        "e".into(),
                        channel.id.clone(),
                        RELAY.into(),
                        "root".into(),
                    ]],
                },
                &key,
            )
            .expect("fixture")
        })
        .collect::<Vec<_>>();
    fixtures.push(channel.clone());
    fixtures.sort_by(|a, b| (b.created_at, &b.id).cmp(&(a.created_at, &a.id)));
    let mut e = Engine::new();
    let mut s = wire::Session::default();
    e.store.insert(channel.clone(), Some(RELAY));
    e.input(
        protocol::Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"channel","id":channel.id}}),
        0,
    );
    e.network.connected(RELAY, 1);
    let mut rows = vec![];
    let mut bottom = false;
    let mut all = std::collections::HashSet::new();
    let mut states = vec![];
    for now in (100..10000).step_by(100) {
        for f in frames(&mut e).iter().filter(|f| f[0] == "REQ") {
            let filter = parse_filter_value(&f[2]).expect("filter");
            for event in fixtures
                .iter()
                .filter(|e| matches_filter(e, &filter))
                .take(filter.limit.unwrap_or(200) as usize)
            {
                if let Some(event) =
                    e.network
                        .message(RELAY, &json!(["EVENT", f[1], event]).to_string(), now)
                {
                    e.enqueue(RELAY.into(), event);
                }
            }
            e.network
                .message(RELAY, &json!(["EOSE", f[1]]).to_string(), now);
        }
        e.tick(now);
        for m in output(&mut s, &mut e) {
            if m["sub"] != "feed" {
                continue;
            }
            if m["t"] == "state" {
                states.push(m["state"].clone());
            }
            if m["t"] == "rows" {
                rows = m["rows"].as_array().expect("rows").clone();
                bottom = m["atBottom"] == true;
            }
            if m["t"] == "patch" {
                apply(&mut rows, m["ops"].as_array().expect("ops"));
            }
        }
        if now > 2000 && now % 500 == 0 {
            for row in rows.iter().filter(|r| r["kind"] == "note") {
                all.insert(row["id"].as_str().expect("id").to_string());
            }
            if bottom {
                break;
            }
            if let Some(key) = rows.last().and_then(|r| r["key"].as_str()) {
                accept(
                    &mut s,
                    &mut e,
                    json!({"t":"window","sub":"feed","anchor":{"key":key},"before":0,"after":50}),
                    now,
                );
            }
        }
    }
    assert!(
        states
            .iter()
            .any(|s| s["phase"] == "live" || s["phase"] == "done"),
        "states: {states:?}; network {}",
        e.network.stats()
    );
    assert!(bottom, "network {}", e.network.stats());
    assert_eq!(all.len(), 230, "paging reaches every fixture");
}
fn apply(rows: &mut Vec<Value>, ops: &[Value]) {
    for op in ops {
        match op["op"].as_str() {
            Some("remove") => rows.retain(|r| r["key"] != op["key"]),
            Some("update") => {
                if let Some(r) = rows.iter_mut().find(|r| r["key"] == op["row"]["key"]) {
                    *r = op["row"].clone();
                }
            }
            Some("insert") => {
                let at = rows
                    .iter()
                    .position(|r| r["key"] == op["before"])
                    .unwrap_or(rows.len());
                rows.splice(at..at, op["rows"].as_array().expect("insert").clone());
            }
            _ => {}
        }
    }
}
#[test]
fn channel_reference_lookup_preempts_and_releases_a_settled_live_slot() {
    use lkjstr_core::engine::network::Network;
    use lkjstr_protocol::NostrFilter;
    let mut n = Network::default();
    n.configure(vec![RELAY.into()], 0);
    n.relay_information(RELAY, r#"{"limitation":{"max_subscriptions":1}}"#);
    let feed = NostrFilter {
        kinds: Some(vec![42]),
        ..Default::default()
    };
    n.plan(
        vec![("channel".into(), feed.clone(), protocol::Query::default())],
        &lkjstr_core::store::Store::new(0),
        0,
    );
    n.connected(RELAY, 1);
    let req = n
        .drain_effects()
        .into_iter()
        .find_map(|f| match f {
            lkjstr_core::engine::network::Effect::Send(_, s) => {
                serde_json::from_str::<Value>(&s).ok()
            }
            _ => None,
        })
        .expect("request");
    n.message(RELAY, &json!(["EOSE", req[1]]).to_string(), 2);
    let id = event(1, 40, "{}", vec![]).id;
    n.plan(
        vec![
            ("channel".into(), feed, protocol::Query::default()),
            (
                "reference".into(),
                NostrFilter {
                    ids: Some(vec![id]),
                    ..Default::default()
                },
                protocol::Query::default(),
            ),
        ],
        &lkjstr_core::store::Store::new(0),
        110,
    );
    n.tick(185);
    let sent = n
        .drain_effects()
        .into_iter()
        .filter_map(|f| match f {
            lkjstr_core::engine::network::Effect::Send(_, s) => {
                serde_json::from_str::<Value>(&s).ok()
            }
            _ => None,
        })
        .collect::<Vec<_>>();
    assert!(sent.iter().any(|m| m[0] == "CLOSE" && m[1] == req[1]));
    let lookup = sent
        .iter()
        .find(|m| m[0] == "REQ" && m[2]["ids"].is_array())
        .expect("lookup");
    n.message(RELAY, &json!(["EOSE", lookup[1]]).to_string(), 186);
    n.tick(286);
    assert!(n.drain_effects().iter().any(|f|matches!(f,lkjstr_core::engine::network::Effect::Send(_,s) if s.contains("REQ")&&s.contains("42"))));
}
