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

#[test]
fn view_entries_are_bounded_and_track_focus_and_window_intent() {
    let mut engine = Engine::new();
    for number in 0..150 {
        open(&mut engine, &format!("s{number:03}"), Query::default());
    }
    let stats = engine.stats();
    assert_eq!(array(&stats, "views").len(), 128);
    let first = &array(&stats, "views")[0];
    assert_eq!(
        first,
        &json!({
            "subId":"view-1","source":"global","visible":true,"focused":false,
            "rowCount":0,"windowKind":"top","freshCount":0
        })
    );
    engine.input(
        Input::Hint {
            visible_subs: vec!["s000".into()],
            focused_sub: Some("s000".into()),
            page_hidden: false,
            idle: false,
            save_data: false,
        },
        1_100,
    );
    engine.input(
        Input::WindowAtMonth {
            sub: "s000".into(),
            anchor: Some("a".repeat(64)),
            month: 12_000,
            before: 10,
            after: 10,
        },
        1_200,
    );
    let stats = engine.stats();
    let views = array(&stats, "views");
    assert_eq!(views[0]["windowKind"], "month");
    assert_eq!(views[0]["anchorAtMs"], 12_000);
    assert_eq!(views[0]["focused"], true);
    assert_eq!(views[1]["visible"], false);
    engine.input(
        Input::Window {
            sub: "s000".into(),
            anchor: Some("a".repeat(64)),
            before: 10,
            after: 10,
        },
        1_300,
    );
    assert_eq!(engine.stats()["views"][0]["windowKind"], "key");

    open(
        &mut engine,
        "s000",
        Query {
            source: Source::TheirHome,
            target: Some("a".repeat(64)),
            ..Query::default()
        },
    );
    engine.input(
        Input::WindowAtTime {
            sub: "s000".into(),
            at: 100,
            before: 10,
            after: 10,
        },
        1_400,
    );
    let stats = engine.stats();
    let view = &array(&stats, "views")[0];
    assert_eq!(view["subId"], "view-1");
    assert_eq!(view["source"], "their-home");
    assert_eq!(view["windowKind"], "at");
    assert_eq!(view["anchorAtMs"], 100);
    assert!(view["olderCoverage"].is_string());
    assert!(view["newerCoverage"].is_string());
}

#[test]
fn traffic_uses_aligned_seconds_and_real_socket_send_outcomes() {
    let mut engine = Engine::new();
    let relay = "wss://traffic.example/";
    let req = r#"["REQ","w1",{"kinds":[1]}]"#;
    let notice = r#"["NOTICE","ok"]"#;
    for second in 1..=91 {
        let now = second * 1000 + 10;
        engine.network.message(relay, notice, now);
        engine.publication_frame_sent(relay, req, true, now);
        engine.publication_frame_sent(relay, req, false, now);
    }
    let stats = engine.stats_at(93_200);
    let buckets = array(&stats, "bandwidthHistory");
    assert_eq!(buckets.len(), 60);
    assert_eq!(buckets[0]["atMs"], 34_000);
    assert_eq!(buckets[0]["bytesIn"], notice.len());
    assert_eq!(buckets[0]["bytesOut"], req.len());
    assert_eq!(buckets[0]["reqsSent"], 1);
    assert_eq!(buckets[59]["atMs"], 93_000);
    assert_eq!(buckets[59]["bytesIn"], 0);
    assert_eq!(
        engine.stats_at(190_000)["bandwidthHistory"][0]["bytesOut"],
        0
    );
}

#[test]
fn decisions_retain_recent_cooldowns_and_redact_private_relay_hosts() {
    let mut engine = Engine::new();
    let relay = "wss://username:password@localhost:7443/room?credential=secret#fragment";
    engine.network.relays.insert(relay.into(), Relay::default());
    for n in 0..40 {
        engine
            .network
            .message(relay, r#"["NOTICE","rate-limited: retry"]"#, n * 1000);
    }
    let stats = engine.stats_at(39_003);
    let events = array(&stats, "orchestrationEvents");
    assert_eq!(events.len(), 32);
    assert_eq!(events[0]["atMs"], 8_000);
    assert_eq!(events[31]["atMs"], 39_000);
    assert!(
        events
            .iter()
            .all(|e| e["kind"] == "cooldown" && e["relay"] == "private-relay")
    );
    let row = &array(&stats, "relays")[0];
    assert_eq!(row["url"], "wss://localhost:7443/room");
    assert_eq!(row["isPrivateHost"], true);
    assert_eq!(row["cooldownRemainingMs"], 119_997);
    assert!(!stats.to_string().contains("secret"));
}

#[path = "feedback_stats_privacy_test.rs"]
mod privacy;

#[test]
fn new_worker_fields_leave_existing_stats_totals_and_relay_counters_available() {
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
    engine.metrics.tick(12.0);
    engine.metrics.tick(4.0);
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
    assert_eq!(
        stats["worker"],
        json!({
            "verifiedTotal":0,"rejectedTotal":0,"droppedTotal":0,"verifyQueueLen":0,
            "verifyIngressBytes":0,"verifyIngressCapBytes":32 * 1024 * 1024,
            "persistenceQueueLen":0,"lastTickMs":4.0,"maxTickMs":12.0,"sliceLimit":32,
            "regularStored":0,"replaceableStored":0,"memoryCapBytes":64 * 1024 * 1024
        })
    );
}
