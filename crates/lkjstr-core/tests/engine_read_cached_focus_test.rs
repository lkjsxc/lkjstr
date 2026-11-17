#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{event, frames};
use lkjstr_core::{
    engine::{
        Engine,
        protocol::{Input, Output, Query, Source},
    },
    store::Store,
};
use lkjstr_protocol::NostrEvent;
use serde_json::Value;
const RELAY: &str = "wss://cached-focus.test/";
const NOW: u64 = 200_000;
fn open(engine: &mut Engine, sub: &str, target: &str, at: u64) {
    engine.input(
        Input::Open {
            sub: sub.into(),
            query: Query {
                source: Source::Thread,
                target: Some(target.into()),
                ..Default::default()
            },
        },
        at,
    );
}
fn advance(engine: &mut Engine, start: u64) -> Vec<Value> {
    let mut sent = frames(engine);
    for tick in [75, 100, 200, 300, 500] {
        engine.tick(start + tick);
        sent.extend(frames(engine));
    }
    sent
}
fn asks_id(frames: &[Value], id: &str) -> bool {
    frames.iter().filter(|f| f[0] == "REQ").any(|f| {
        f.as_array().expect("request").iter().skip(2).any(|filter| {
            filter["ids"]
                .as_array()
                .is_some_and(|ids| ids.iter().any(|value| value == id))
        })
    })
}
fn setup(note: Option<&NostrEvent>) -> Engine {
    let mut engine = Engine::new();
    engine.network.configure(vec![RELAY.into()], NOW);
    if let Some(note) = note {
        engine.store.insert(note.clone(), Some("cache"));
    }
    engine
}
#[test]
fn cached_focus_renders_before_relay_and_does_not_repeat_immutable_lookup() {
    let focus = event(100, 1, "cached focus", vec![]);
    let mut engine = setup(Some(&focus));
    open(&mut engine, "thread", &focus.id, NOW);
    assert!(
        engine.drain().iter().any(|out| matches!(out,
            Output::Rows { items, .. } if items.iter().any(|row| row.id == focus.id)
        )),
        "verified cached row is available before any relay response"
    );
    engine.network.connected(RELAY, NOW);
    let sent = advance(&mut engine, NOW);
    assert!(
        !asks_id(&sent, &focus.id),
        "the immutable focus is already held"
    );
    assert!(
        sent.iter().filter(|f| f[0] == "REQ").any(|f| {
            f.as_array().expect("request").iter().skip(2).any(|filter| {
                filter["#e"]
                    .as_array()
                    .is_some_and(|ids| ids.iter().any(|id| id == &focus.id))
            })
        }),
        "reply/count freshness still needs its own read"
    );
}
#[test]
fn reopening_cached_thread_does_not_replay_another_views_shared_reply_stream() {
    let focus = event(100, 1, "shared focus", vec![]);
    let mut engine = setup(Some(&focus));
    open(&mut engine, "first", &focus.id, NOW);
    open(&mut engine, "second", &focus.id, NOW);
    engine.network.connected(RELAY, NOW);
    advance(&mut engine, NOW);
    let before = engine.network.request_stats();
    engine.input(
        Input::Close {
            sub: "second".into(),
        },
        NOW + 600,
    );
    open(&mut engine, "second", &focus.id, NOW + 601);
    let sent = advance(&mut engine, NOW + 601);
    assert!(!asks_id(&sent, &focus.id));
    assert!(
        !sent.iter().any(|frame| frame[0] == "CLOSE"),
        "surviving owner keeps its wire"
    );
    assert_eq!(
        before,
        engine.network.request_stats(),
        "exact ownership restores without a replay"
    );
}
#[test]
fn a_missing_focus_is_still_requested() {
    let focus = event(100, 1, "missing focus", vec![]);
    let mut engine = setup(None);
    open(&mut engine, "thread", &focus.id, NOW);
    engine.network.connected(RELAY, NOW);
    assert!(asks_id(&advance(&mut engine, NOW), &focus.id));
}
#[test]
fn losing_the_cached_event_recreates_the_lookup_on_the_next_want() {
    let focus = event(100, 1, "evicted focus", vec![]);
    let mut engine = setup(None);
    engine.store = Store::with_caps(1, 16);
    engine.store.insert(focus.clone(), Some("cache"));
    open(&mut engine, "thread", &focus.id, NOW);
    engine.network.connected(RELAY, NOW);
    assert!(!asks_id(&advance(&mut engine, NOW), &focus.id));
    engine
        .store
        .insert(event(101, 1, "newer retained event", vec![]), Some("cache"));
    assert!(engine.store.get(&focus.id).is_none());
    open(&mut engine, "thread", &focus.id, NOW + 600);
    assert!(asks_id(&advance(&mut engine, NOW + 600), &focus.id));
}
#[test]
fn held_focus_does_not_suppress_a_missing_parent() {
    let parent = event(99, 1, "missing ancestor", vec![]);
    let focus = event(
        100,
        1,
        "cached reply",
        vec![vec![
            "e".into(),
            parent.id.clone(),
            "".into(),
            "reply".into(),
        ]],
    );
    let mut engine = setup(Some(&focus));
    open(&mut engine, "thread", &focus.id, NOW);
    engine.network.connected(RELAY, NOW);
    let sent = advance(&mut engine, NOW);
    assert!(!asks_id(&sent, &focus.id));
    assert!(
        asks_id(&sent, &parent.id),
        "each missing reference keeps its own demand"
    );
}
