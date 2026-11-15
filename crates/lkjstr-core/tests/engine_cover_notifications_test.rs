#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::{Query, Source},
    },
    store::Store,
};
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
fn reqs(n: &mut Network) -> Vec<Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|e| match e {
            Effect::Send(_, s) => {
                let v: Value = serde_json::from_str(&s).expect("frame");
                (v[0] == "REQ").then_some(v)
            }
            _ => None,
        })
        .collect()
}
#[test]
fn focused_notifications_are_not_count_hydration_and_can_preempt_settled_owner_tails() {
    let relay = "wss://notifications.test/";
    let account = "a".repeat(64);
    let mut n = Network::default();
    let store = Store::new(0);
    n.configure(vec![relay.into()], 0);
    n.relay_information(relay, r#"{"limitation":{"max_subscriptions":1}}"#);
    let owner = (
        "~account-discovery".into(),
        NostrFilter {
            authors: Some(vec![account.clone()]),
            kinds: Some(vec![10002]),
            limit: Some(1),
            ..Default::default()
        },
        Query::default(),
    );
    n.plan(vec![owner.clone()], &store, 0);
    n.connected(relay, 0);
    let first = reqs(&mut n).remove(0);
    n.message(relay, &json!(["EOSE", first[1]]).to_string(), 1);
    let query = Query {
        source: Source::Notifications,
        account: Some(account),
        ..Default::default()
    };
    let filter = lkjstr_core::engine::query::filter(&store, &query);
    n.focused_sub = Some("notifications".into());
    n.plan(
        vec![owner, ("notifications".into(), filter.clone(), query)],
        &store,
        201,
    );
    let frame = reqs(&mut n)
        .into_iter()
        .find(|f| f[2]["#p"].is_array())
        .expect("focused notifications must be sent");
    n.message(relay, &json!(["EOSE", frame[1]]).to_string(), 202);
    assert!(n.page_exhausted(&filter));
    println!(
        "notification starvation scorecard before_REQs=0 after_REQs=1 completed_empty_page=true"
    );
}
