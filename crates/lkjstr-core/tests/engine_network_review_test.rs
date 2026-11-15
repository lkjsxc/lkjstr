#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{
    Engine,
    clients::Clients,
    network::{Effect, Network},
    protocol::{Input, Output, Query},
    wire::Session,
};
use lkjstr_protocol::NostrFilter;
use serde_json::json;
fn want(sub: &str) -> (String, NostrFilter, Query) {
    (
        sub.into(),
        NostrFilter {
            kinds: Some(vec![1]),
            search: Some(sub.into()),
            ..Default::default()
        },
        Query::default(),
    )
}
fn requests(n: &mut Network) -> Vec<serde_json::Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|f| match f {
            Effect::Send(_, t) => {
                let v: serde_json::Value = serde_json::from_str(&t).expect("frame");
                (v[0] == "REQ").then_some(v)
            }
            _ => None,
        })
        .collect()
}
#[test]
fn queued_work_survives_deadline_and_sends_when_capacity_is_released() {
    let mut n = Network::default();
    n.configure(vec![RELAY.into()], 0);
    n.plan(
        (0..5).map(|i| want(&format!("s{i}"))).collect(),
        &lkjstr_core::store::Store::new(0),
        0,
    );
    n.connected(RELAY, 10);
    let mut sent = requests(&mut n);
    for now in [110, 210, 310] {
        n.tick(now);
        sent.extend(requests(&mut n));
    }
    assert_eq!(sent.len(), 4);
    for req in sent {
        n.message(RELAY, &json!(["EOSE", req[1]]).to_string(), 400);
    }
    n.drain_output();
    n.tick(20000);
    assert!(
        !n.drain_output()
            .iter()
            .any(|o| matches!(o, Output::Status {sub,..} if sub=="s4"))
    );
    n.plan(vec![want("s4")], &lkjstr_core::store::Store::new(0), 20001);
    let sent = requests(&mut n);
    assert_eq!(sent.len(), 1);
    assert_eq!(sent[0][2]["search"], "s4");
}
#[test]
fn rate_limit_retries_after_cooldown_but_terminal_refusal_does_not() {
    for reason in ["rate-limited: slow down", "blocked: denied"] {
        let mut n = Network::default();
        n.configure(vec![RELAY.into()], 0);
        n.plan(vec![want("feed")], &lkjstr_core::store::Store::new(0), 0);
        n.connected(RELAY, 10);
        let req = requests(&mut n).remove(0);
        n.message(RELAY, &json!(["CLOSED", req[1], reason]).to_string(), 20);
        n.tick(16000);
        assert!(requests(&mut n).is_empty());
        n.plan(
            vec![want("feed")],
            &lkjstr_core::store::Store::new(0),
            30019,
        );
        assert!(requests(&mut n).is_empty());
        n.tick(30020);
        assert_eq!(
            requests(&mut n).len(),
            usize::from(reason.starts_with("rate-limited:"))
        );
    }
}
#[test]
fn connecting_sockets_are_released_on_close_hide_and_watchdog() {
    for hide in [false, true] {
        let mut e = Engine::new();
        e.input(
            Input::Configure {
                relays: vec![RELAY.into()],
            },
            0,
        );
        open(&mut e, Query::default());
        assert!(
            e.network
                .drain_effects()
                .iter()
                .any(|f| matches!(f, Effect::Connect(_)))
        );
        e.input(
            if hide {
                Input::Hint {
                    visible_subs: vec![],
                    page_hidden: true,
                    idle: false,
                    save_data: false,
                }
            } else {
                Input::Close { sub: "feed".into() }
            },
            1,
        );
        assert!(
            e.network
                .drain_effects()
                .iter()
                .any(|f| matches!(f, Effect::Disconnect(_)))
        );
        assert!(!e.network.relays[RELAY].connecting);
    }
    let mut n = Network::default();
    n.configure(vec![RELAY.into()], 0);
    n.plan(vec![want("feed")], &lkjstr_core::store::Store::new(0), 0);
    n.drain_effects();
    n.tick(15000);
    assert!(
        n.drain_effects()
            .iter()
            .any(|f| matches!(f, Effect::Disconnect(_)))
    );
    n.tick(17000);
    assert!(
        n.drain_effects()
            .iter()
            .any(|f| matches!(f, Effect::Connect(_)))
    );
}
#[test]
fn shared_progress_is_captured_before_namespaces_are_stripped() {
    let mut e = Engine::new();
    e.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    let mut c = Clients::default();
    let id = c.connect(0).expect("client");
    let mut s = Session::default();
    let input =
        serde_json::from_value(json!({"t":"open","sub":"feed","query":{"source":"global"}}))
            .expect("input");
    for input in s.input(input, &e).expect("translate") {
        for input in c.input(id, input, 0) {
            e.input(input, 0);
        }
    }
    e.network.connected(RELAY, 10);
    let req = frames(&mut e)
        .into_iter()
        .find(|f| f[0] == "REQ")
        .expect("req");
    e.network
        .message(RELAY, &json!(["EOSE", req[1]]).to_string(), 20);
    e.tick(75);
    let out: Vec<_> = e
        .drain()
        .into_iter()
        .flat_map(|o| c.output(o))
        .flat_map(|(_, o)| s.output(o, &e))
        .map(|o| serde_json::to_value(o).expect("out"))
        .collect();
    assert!(out.iter().any(|o| o["t"] == "state"
        && o["sub"] == "feed"
        && o["state"]["relaysAsked"] == 1
        && o["state"]["relaysAnswered"] == 1));
}
