#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    Engine,
    protocol::{Input, Query, Source},
};
use lkjstr_protocol::NostrEvent;
use serde_json::json;
#[test]
fn coverage_requires_both_a_verified_write_list_and_an_active_request() {
    let mut e = Engine::new();
    let owner = "a".repeat(64);
    let person = "b".repeat(64);
    let relay = "wss://stats.test/";
    for (id, author, kind, tags) in [
        (1, owner.clone(), 3, vec![vec!["p".into(), person.clone()]]),
        (
            2,
            person.clone(),
            10002,
            vec![vec!["r".into(), relay.into(), "write".into()]],
        ),
    ] {
        e.store.insert(
            NostrEvent {
                id: format!("{id:064x}"),
                pubkey: author,
                kind,
                created_at: 1,
                tags,
                content: String::new(),
                sig: "0".repeat(128),
            },
            None,
        );
    }
    e.network.configure(vec![relay.into()], 0);
    e.input(
        Input::Open {
            sub: "home".into(),
            query: Query {
                source: Source::Home,
                account: Some(owner),
                ..Default::default()
            },
        },
        0,
    );
    assert_eq!(e.stats()["relays"][0]["followedCovered"], 0);
    e.network.connected(relay, 1);
    let stats = e.stats();
    assert_eq!(stats["relays"][0]["readRule"], "reader");
    assert_eq!(stats["relays"][0]["followedCovered"], 1);
    assert_eq!(stats["relays"][0]["weight"], 600);
    assert!(
        stats["requests"]
            .as_array()
            .expect("requests")
            .iter()
            .all(|r| r["purpose"].is_string())
    );
    e.input(Input::Close { sub: "home".into() }, 200);
    assert_eq!(e.stats()["relays"][0]["followedCovered"], 0);
    assert_eq!(e.stats()["relays"][0]["readRule"], "unused");
    assert_eq!(e.stats()["requests"], json!([]));
    println!(
        "stats scorecard relay_routing_fields before=0 after=3 request_purposes before=0 after=all stale_coverage=0"
    );
}
