#![allow(clippy::expect_used)]
use crate::engine::{
    Engine,
    network::Relay,
    protocol::{Input, Query, Source},
};
use serde_json::{Value, json};

fn open(engine: &mut Engine, sub: &str, query: Query) {
    engine.input(
        Input::Open {
            sub: sub.into(),
            query,
        },
        1_000,
    );
}

fn array<'a>(stats: &'a Value, key: &str) -> &'a [Value] {
    stats[key].as_array().expect("Stats array")
}

#[path = "feedback_stats_privacy_test.rs"]
mod privacy;

#[test]
fn stats_reports_totals_and_relay_counters() {
    let mut engine = Engine::new();
    let relay = "wss://traffic.example/";
    engine.network.relays.insert(
        relay.into(),
        Relay {
            online: true,
            received: 7,
            duplicates: 3,
            useful: 4,
            bytes_in: 21,
            bytes_out: 8,
            ..Relay::default()
        },
    );
    let stats = engine.stats();
    assert_eq!(
        stats["totals"],
        json!({
            "eventsStored":0,"cacheBytes":0,"subscriptions":0,"servedFromCache":0,"servedFromNetwork":4
        })
    );
    assert_eq!(
        stats["orchestration"],
        json!({"relaysCoveringFollowSet":0,"requestsCoalesced":0})
    );
    assert!(array(&stats, "requests").is_empty());
    assert!(array(&stats, "recentPublications").is_empty());
    let row = &stats["relays"][0];
    assert_eq!(row["url"], relay);
    assert_eq!(row["state"], "connected");
    assert_eq!(row["eventsReceived"], 7);
    assert_eq!(row["duplicatesDropped"], 3);
    assert_eq!(row["bytesIn"], 21);
    assert_eq!(row["bytesOut"], 8);
}

#[test]
fn stats_requests_keep_the_routing_table_fields() {
    let mut engine = Engine::new();
    let relay = "wss://timing.example/";
    engine.network.configure(vec![relay.into()], 900);
    open(&mut engine, "raw-client-id", Query::default());
    engine.network.connected(relay, 1_100);
    let stats = engine.stats();
    let request = array(&stats, "requests")
        .iter()
        .find(|request| request["relay"] == relay)
        .expect("request on configured relay");
    assert!(request["id"].is_string());
    assert!(request["wireId"].is_string());
    assert!(request["purpose"].is_string());
    assert!(request["priority"].is_number());
    assert!(request["weight"].is_number());
    assert_eq!(request["received"], 0);
    assert_eq!(request["sent"], true);
    assert_eq!(request["complete"], false);
    assert_eq!(request["members"], 1);
    assert!(!stats.to_string().contains("raw-client-id"));
}
