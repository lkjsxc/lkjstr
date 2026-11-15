#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{event, frames};
use lkjstr_core::engine::{
    Engine,
    protocol::{Input, Query},
};
use serde_json::json;
#[test]
fn stats_count_shared_requests_frames_duplicate_events_bytes_and_latency() {
    let mut e = Engine::new();
    let relay = "wss://local.test/";
    e.input(
        Input::Configure {
            relays: vec![relay.into()],
        },
        0,
    );
    for sub in ["one", "two"] {
        e.input(
            Input::Open {
                sub: sub.into(),
                query: Query::default(),
            },
            0,
        );
    }
    e.network.connected(relay, 1);
    let req = frames(&mut e)
        .into_iter()
        .find(|f| f[0] == "REQ")
        .expect("request")[1]
        .clone();
    let row = event(100, 1, "stats", vec![]);
    let frame = json!(["EVENT", req, row]).to_string();
    for _ in 0..2 {
        let event = e.network.message(relay, &frame, 2).expect("matching event");
        e.enqueue(relay.into(), event);
    }
    e.tick(3);
    e.network
        .message(relay, &json!(["EOSE", req]).to_string(), 50);
    let stats = e.stats();
    let r = &stats["relays"][0];
    assert_eq!(r["eventsReceived"], 2);
    assert_eq!(r["duplicatesDropped"], 1);
    assert_eq!(r["connectedSince"], 1);
    assert!(r["bytesIn"].as_u64().expect("bytes") >= 2 * frame.len() as u64);
    assert!(r["bytesOut"].as_u64().expect("bytes") > 0);
    assert_eq!(r["latencyMs"], 49);
    assert!(
        stats["orchestration"]["requestsCoalesced"]
            .as_u64()
            .expect("shared")
            > 0
    );
    assert_eq!(stats["totals"]["servedFromNetwork"], 1);
    e.network.disconnected(relay, 51);
    assert_eq!(e.stats()["relays"][0]["lastError"], "connection-lost");
}

#[test]
fn default_upload_selection_waits_for_the_owner_lookup() {
    let mut e = Engine::new();
    let list = event(
        1,
        10063,
        "",
        vec![vec!["server".into(), "https://chosen.test".into()]],
    );
    let owner = list.pubkey.clone();
    assert!(!e.upload_servers_ready(&owner));
    e.store.insert(list, None);
    assert!(e.upload_servers_ready(&owner));
    assert_eq!(e.upload_servers(&owner), vec!["https://chosen.test"]);
}
