//! One relay opened on its own: its own reader, only the notes it served, its NIP-11 facts in the header row.
#![allow(clippy::expect_used)]
mod engine_review_support;
#[path = "cache_context/support.rs"]
mod support;
use engine_review_support::{accept, output};
use lkjstr_core::engine::{Engine, network::Effect, wire};
use lkjstr_protocol::generate_secret_key;
use serde_json::{Value, json};
use support::event;

const MINE: &str = "wss://mine.test/";
const BROWSED: &str = "wss://browsed.test/";

fn rows(frames: &[Value]) -> Vec<Value> {
    frames
        .iter()
        .rev()
        .find(|v| v["t"] == "rows")
        .and_then(|v| v["rows"].as_array().cloned())
        .unwrap_or_default()
}
fn open(s: &mut wire::Session, e: &mut Engine) -> Vec<Value> {
    accept(
        s,
        e,
        json!({"t":"open","sub":"relay","query":{"source":"relay","relay":"wss://BROWSED.test"},"visible":true}),
        0,
    );
    accept(
        s,
        e,
        json!({"t":"window","sub":"relay","anchor":"top","before":0,"after":50}),
        0,
    );
    rows(&output(s, e))
}
/// The window as it is now (later changes come as patches; asking again gives whole rows).
fn reread(s: &mut wire::Session, e: &mut Engine) -> Vec<Value> {
    output(s, e);
    accept(
        s,
        e,
        json!({"t":"window","sub":"relay","anchor":"top","before":0,"after":50}),
        2000,
    );
    rows(&output(s, e))
}

#[test]
fn a_browsed_relay_shows_only_what_it_served_and_gets_its_own_reader() {
    let key = generate_secret_key();
    let mut e = Engine::new();
    e.network.configure(vec![MINE.into()], 0);
    let only_mine = event(&key, 1, 100, "from my relay", vec![]);
    let served = event(&key, 1, 200, "from the browsed relay", vec![]);
    e.store.insert(only_mine.clone(), Some(MINE));
    e.store.insert(served.clone(), Some(BROWSED));
    let mut s = wire::Session::default();
    let first = open(&mut s, &mut e);
    assert_eq!(first[0]["kind"], "relay");
    assert_eq!(first[0]["url"], BROWSED);
    assert_eq!(first[0]["read"], false, "not on the reader's list");
    assert_eq!(first[0]["info"], "unknown");
    let ids: Vec<_> = first.iter().skip(1).map(|r| r["id"].clone()).collect();
    assert_eq!(ids, [json!(served.id)]);

    e.tick(1);
    let effects = e.network.drain_effects();
    assert!(
        effects
            .iter()
            .any(|f| matches!(f, Effect::Inspect(u) if u == BROWSED))
    );
    e.network.connected(BROWSED, 2);
    e.tick(3);
    let reqs: Vec<_> = e
        .network
        .drain_effects()
        .into_iter()
        .filter_map(|f| match f {
            Effect::Send(url, text) if text.starts_with("[\"REQ\"") => Some(url),
            _ => None,
        })
        .collect();
    assert!(
        reqs.iter().any(|u| u == BROWSED),
        "a REQ goes to the browsed relay: {reqs:?}"
    );

    // The browsed relay serves a note the device already held from the reader's own relay.
    e.enqueue(BROWSED.into(), only_mine.clone());
    e.tick(1000);
    let next = reread(&mut s, &mut e);
    let ids: Vec<_> = next.iter().skip(1).map(|r| r["id"].clone()).collect();
    assert_eq!(ids, [json!(served.id), json!(only_mine.id)]);

    // Live: a new note the relay sends flows in at the head; one from the reader's own relay does not.
    let fresh = event(&key, 1, 300, "just now on the browsed relay", vec![]);
    let elsewhere = event(&key, 1, 400, "just now on my relay", vec![]);
    e.enqueue(BROWSED.into(), fresh.clone());
    e.enqueue(MINE.into(), elsewhere);
    e.tick(3000);
    let live = reread(&mut s, &mut e);
    let ids: Vec<_> = live.iter().skip(1).map(|r| r["id"].clone()).collect();
    assert_eq!(
        ids,
        [json!(fresh.id), json!(served.id), json!(only_mine.id)]
    );
}

#[test]
fn the_header_carries_bounded_nip11_facts_or_says_none_came() {
    let mut e = Engine::new();
    let mut s = wire::Session::default();
    open(&mut s, &mut e);
    e.tick(1);
    let admin = "ab".repeat(32);
    let doc = json!({"name":"Browsed\u{0007} relay","description":"x".repeat(900),"software":"git+https://example.test/relay",
        "version":"1.2","pubkey":admin,"supported_nips":[50,1,11,1,99999],
        "limitation":{"auth_required":true,"payment_required":false,"restricted_writes":true,"min_pow_difficulty":8}});
    e.relay_information(BROWSED, Some(&doc.to_string()));
    e.tick(1000);
    let head = reread(&mut s, &mut e)[0].clone();
    assert_eq!(head["info"], "ready");
    assert_eq!(head["name"], "Browsed  relay");
    assert_eq!(
        head["description"].as_str().map(|d| d.chars().count()),
        Some(600)
    );
    assert_eq!(head["nips"], json!([1, 11, 50]));
    assert_eq!(head["limits"], json!(["auth", "restricted"]));
    assert_eq!(head["pow"], 8);
    assert_eq!(head["admin"]["pubkey"], admin);

    let mut e = Engine::new();
    let mut s = wire::Session::default();
    open(&mut s, &mut e);
    e.tick(1);
    e.relay_information(BROWSED, None);
    e.tick(1000);
    assert_eq!(reread(&mut s, &mut e)[0]["info"], "missing");
}

#[test]
fn a_relay_query_that_is_not_a_relay_address_is_refused() {
    let e = Engine::new();
    let mut s = wire::Session::default();
    let input = serde_json::from_value(
        json!({"t":"open","sub":"r","query":{"source":"relay","relay":"https://not-a-relay.test"}}),
    )
    .expect("wire input");
    assert!(s.input(input, &e).is_err());
}

fn sent(e: &mut Engine) -> (Vec<Value>, Vec<String>) {
    let (mut frames, mut gone) = (vec![], vec![]);
    for f in e.network.drain_effects() {
        match f {
            Effect::Send(url, text) if url == BROWSED => {
                frames.push(serde_json::from_str(&text).expect("frame"));
            }
            Effect::Disconnect(url) => gone.push(url),
            _ => {}
        }
    }
    (frames, gone)
}

#[test]
fn the_subscription_stays_open_while_the_tab_is_and_is_closed_with_it() {
    let key = generate_secret_key();
    let mut e = Engine::new();
    e.network.configure(vec![MINE.into()], 0);
    let mut s = wire::Session::default();
    open(&mut s, &mut e);
    e.tick(1);
    e.network.connected(BROWSED, 2);
    e.tick(3);
    let (frames, _) = sent(&mut e);
    let reqs: Vec<_> = frames.iter().filter(|f| f[0] == "REQ").collect();
    let live: Vec<_> = reqs
        .iter()
        .filter(|f| f[2].get("until").is_none())
        .map(|f| f[1].clone())
        .collect();
    assert!(!live.is_empty(), "an open-ended REQ: {reqs:?}");

    // The relay finishes its stored answer; the subscription is kept for what comes next.
    for req in &reqs {
        e.network
            .message(BROWSED, &json!(["EOSE", req[1]]).to_string(), 10);
    }
    e.tick(1000);
    e.tick(60_000);
    let (frames, gone) = sent(&mut e);
    let closed = |frames: &[Value]| -> Vec<Value> {
        frames
            .iter()
            .filter(|f| f[0] == "CLOSE")
            .map(|f| f[1].clone())
            .collect()
    };
    let early = closed(&frames);
    assert!(
        live.iter().any(|id| !early.contains(id)),
        "a live REQ survives the end of stored events: {early:?}"
    );
    assert!(gone.is_empty(), "the reader stays: {gone:?}");
    assert!(e.network.relays.contains_key(BROWSED));
    let later = event(&key, 1, 500, "after the stored answer", vec![]);
    e.enqueue(BROWSED.into(), later.clone());
    e.tick(61_000);
    assert_eq!(reread(&mut s, &mut e)[1]["id"], json!(later.id));
    sent(&mut e);

    // Closing the tab closes every subscription on that relay and lets its socket go.
    accept(&mut s, &mut e, json!({"t":"close","sub":"relay"}), 62_000);
    e.tick(62_001);
    e.tick(63_000);
    let (frames, gone) = sent(&mut e);
    let all: Vec<Value> = early.into_iter().chain(closed(&frames)).collect();
    for id in &live {
        assert!(all.contains(id), "CLOSE for {id}: {frames:?}");
    }
    assert!(gone.iter().any(|url| url == BROWSED), "socket released");
    assert!(!e.network.relays.contains_key(BROWSED), "reader released");
    assert!(e.network.relays.contains_key(MINE), "my relay stays known");
}
