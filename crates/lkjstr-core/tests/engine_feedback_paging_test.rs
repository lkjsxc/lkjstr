#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{RELAY, event, frames};
use lkjstr_core::engine::{
    Engine,
    protocol::{Filters, Input, Query},
};
use serde_json::{Value, json};
#[test]
fn an_underfilled_window_continues_after_eose_without_another_window_message() {
    let mut e = Engine::new();
    e.signed_out_global_filter = false;
    e.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    e.network
        .relay_information(RELAY, r#"{"limitation":{"max_limit":3}}"#);
    e.input(
        Input::Open {
            sub: "feed".into(),
            query: Query {
                filters: Filters {
                    until: Some(100),
                    ..Default::default()
                },
                ..Default::default()
            },
        },
        0,
    );
    e.network.connected(RELAY, 1);
    let req = frames(&mut e)
        .into_iter()
        .find(|f| f[0] == "REQ" && f[2]["kinds"] == json!([1, 6]))
        .expect("head");
    for at in [30, 20, 10] {
        let row = event(at, 1, "page", vec![]);
        let row = e
            .network
            .message(RELAY, &json!(["EVENT", req[1], row]).to_string(), 2)
            .expect("event");
        e.enqueue(RELAY.into(), row);
    }
    e.network
        .message(RELAY, &json!(["EOSE", req[1]]).to_string(), 3);
    e.tick(4);
    let mut requested = Vec::<Value>::new();
    for now in [100, 200, 300] {
        e.tick(now);
        requested.extend(frames(&mut e));
    }
    assert!(
        requested
            .iter()
            .any(|f| f[0] == "REQ" && f[2]["until"] == 10)
    );
}

#[test]
fn history_preempts_settled_count_requests_and_counts_resume() {
    use lkjstr_core::engine::network::Network;
    use lkjstr_protocol::NostrFilter;
    let mut n = Network::default();
    n.configure(vec![RELAY.into()], 0);
    n.relay_information(RELAY, r#"{"limitation":{"max_subscriptions":1}}"#);
    let counts = NostrFilter {
        kinds: Some(vec![1, 6, 7, 9735]),
        ..Default::default()
    };
    n.plan(vec![("counts".into(), counts.clone(), Query::default())], 0);
    n.connected(RELAY, 1);
    let req = n
        .drain_effects()
        .into_iter()
        .find_map(|f| match f {
            lkjstr_core::engine::network::Effect::Send(_, text) => {
                Some(serde_json::from_str::<Value>(&text).expect("frame"))
            }
            _ => None,
        })
        .expect("count request");
    n.message(RELAY, &json!(["EOSE", req[1]]).to_string(), 2);
    let page = NostrFilter {
        kinds: Some(vec![1, 6]),
        until: Some(100),
        ..Default::default()
    };
    n.plan(
        vec![
            ("counts".into(), counts, Query::default()),
            ("feed".into(), page, Query::default()),
        ],
        110,
    );
    let effects = n
        .drain_effects()
        .into_iter()
        .filter_map(|f| match f {
            lkjstr_core::engine::network::Effect::Send(_, text) => {
                Some(serde_json::from_str::<Value>(&text).expect("frame"))
            }
            _ => None,
        })
        .collect::<Vec<_>>();
    assert!(effects.iter().any(|f| f[0] == "CLOSE" && f[1] == req[1]));
    let page = effects
        .iter()
        .find(|f| f[0] == "REQ" && f[2]["until"] == 100)
        .expect("history sent");
    n.message(RELAY, &json!(["EOSE", page[1]]).to_string(), 111);
    n.tick(220);
    assert!(n.drain_effects().iter().any(
        |f| matches!(f, lkjstr_core::engine::network::Effect::Send(_,text) if text.contains("REQ"))
    ));
}
