#![allow(clippy::unwrap_used)]
#[path = "engine_zaps/common/mod.rs"]
mod common;
use common::{event, key, tag};
use lkjstr_core::engine::{
    Engine,
    protocol::{Input, Query, Source},
    zaps::Target,
};
use lkjstr_protocol::NostrEvent;
use std::sync::OnceLock;
fn fixtures() -> &'static Vec<NostrEvent> {
    static FIXTURES: OnceLock<Vec<NostrEvent>> = OnceLock::new();
    FIXTURES.get_or_init(|| {
        let mut events = Vec::new();
        for i in 0..802_u64 {
            let author = if i == 801 { 3 } else { 2 };
            let note = event(author, 1, vec![], "signed demand fixture", i + 1);
            // Signed receipt candidates are sufficient for admission; incomplete
            // invoice claims must never be projected as trusted amounts.
            let candidate = event(
                4,
                9735,
                vec![tag(&["e", &note.id]), tag(&["p", &note.pubkey])],
                "",
                i + 1000,
            );
            events.extend([note, candidate]);
        }
        events
    })
}
fn engine() -> Engine {
    let mut e = Engine::new();
    for raw in fixtures() {
        e.store.insert(raw.clone(), None);
    }
    e
}
fn open(e: &mut Engine, sub: &str, author: u8, after: usize) {
    e.input(
        Input::Open {
            sub: sub.into(),
            query: Query {
                source: Source::Profile,
                target: Some(key(author).public_key()),
                ..Default::default()
            },
        },
        2_000_000,
    );
    e.input(
        Input::Window {
            sub: sub.into(),
            anchor: None,
            before: 0,
            after,
        },
        2_000_000,
    );
}
fn demanded(e: &Engine, id: &str) -> bool {
    e.zaps.targets().contains(&Target::Event { id: id.into() })
}
#[test]
fn full_first_tile_cannot_starve_a_later_visible_tile() {
    let mut e = engine();
    open(&mut e, "a-retained", 2, 799);
    open(&mut e, "z-other", 3, 1);
    e.zap_refresh(2_000_000);
    let other = &fixtures()[1602].id;
    assert!(
        demanded(&e, other),
        "another visible tile must share bounded receipt demand"
    );
    assert!(e.zaps.targets().len() <= 1024);
    e.input(
        Input::Hint {
            visible_subs: vec!["z-other".into()],
            focused_sub: Some("z-other".into()),
            page_hidden: false,
            idle: false,
            save_data: false,
        },
        2_000_100,
    );
    e.zap_refresh(2_000_100);
    assert_eq!(e.zaps.targets(), &[Target::Event { id: other.clone() }]);
}
#[test]
fn retained_history_does_not_starve_its_current_reading_anchor() {
    let mut e = engine();
    open(&mut e, "history", 2, 800);
    let anchor = &fixtures()[0].id;
    e.input(
        Input::Window {
            sub: "history".into(),
            anchor: Some(anchor.clone()),
            before: 800,
            after: 0,
        },
        2_000_000,
    );
    e.zap_refresh(2_000_000);
    assert!(
        demanded(&e, anchor),
        "the current reading anchor must precede retained offscreen history"
    );
}
#[test]
fn duplicate_view_targets_do_not_consume_distinct_target_capacity() {
    let mut e = engine();
    for i in 0..8 {
        open(&mut e, &format!("a-duplicate-{i}"), 2, 99);
    }
    open(&mut e, "z-other", 3, 1);
    e.zap_refresh(2_000_000);
    assert!(
        demanded(&e, &fixtures()[1602].id),
        "repeated views of the same notes must not consume the distinct target cap"
    );
    let unique: std::collections::BTreeSet<_> = e.zaps.targets().iter().collect();
    assert_eq!(unique.len(), e.zaps.targets().len());
    assert!(unique.len() <= 101);
}
#[test]
fn reading_intent_moves_inside_retained_history_without_moving_the_window() {
    let mut e = engine();
    open(&mut e, "history", 2, 800);
    let oldest = fixtures()[0].id.clone();
    let middle = fixtures()[800].id.clone();
    e.input(
        Input::Window {
            sub: "history".into(),
            anchor: Some(oldest.clone()),
            before: 800,
            after: 0,
        },
        2_000_000,
    );
    e.drain();
    e.input(
        Input::Reading {
            sub: "history".into(),
            id: Some(middle.clone()),
        },
        2_000_001,
    );
    e.zap_refresh(2_000_001);
    assert!(
        demanded(&e, &middle),
        "reading intent inside retained history must own current demand"
    );
    assert!(!demanded(&e, &oldest));
    assert!(!e.drain().iter().any(|o| matches!(
        o,
        lkjstr_core::engine::protocol::Output::Rows { .. }
            | lkjstr_core::engine::protocol::Output::Patch { .. }
    )));
    e.input(
        Input::Reading {
            sub: "history".into(),
            id: Some(fixtures()[1602].id.clone()),
        },
        2_000_002,
    );
    e.zap_refresh(2_000_002);
    assert!(
        demanded(&e, &middle),
        "an undelivered target cannot replace current intent"
    );
    e.input(
        Input::Hint {
            visible_subs: vec![],
            focused_sub: None,
            page_hidden: false,
            idle: false,
            save_data: false,
        },
        2_000_003,
    );
    e.zap_refresh(2_000_003);
    assert!(e.zaps.targets().is_empty());
    open(&mut e, "history", 3, 1);
    e.zap_refresh(2_000_004);
    assert_eq!(
        e.zaps.targets(),
        &[Target::Event {
            id: fixtures()[1602].id.clone()
        }]
    );
}
#[test]
fn reading_wire_accepts_only_that_subscriptions_delivered_note_keys() {
    use lkjstr_core::engine::wire::{Input as WireInput, Session};
    use serde_json::json;
    let mut e = engine();
    let mut wire = Session::default();
    let opening: WireInput = serde_json::from_value(json!({
        "t":"open", "sub":"first", "query":{"source":"profile","pubkey":key(2).public_key()}
    }))
    .unwrap();
    for input in wire.input(opening, &e).unwrap() {
        e.input(input, 2_000_000);
    }
    let delivered: Vec<_> = e
        .drain()
        .into_iter()
        .flat_map(|o| wire.output(o, &e))
        .collect();
    let rows = delivered
        .iter()
        .find_map(|o| {
            if let lkjstr_core::engine::wire::Output::Rows { rows, .. } = o {
                Some(rows)
            } else {
                None
            }
        })
        .unwrap();
    let note = rows.iter().find(|r| r["kind"] == "note").unwrap();
    let input = |sub: &str, key: serde_json::Value| {
        serde_json::from_value::<WireInput>(json!({"t":"reading","sub":sub,"key":key})).unwrap()
    };
    let accepted = wire.input(input("first", note["key"].clone()), &e).unwrap();
    assert!(
        matches!(&accepted[..], [Input::Reading { id: Some(id), .. }] if id == note["id"].as_str().unwrap())
    );
    assert!(
        wire.input(input("other", note["key"].clone()), &e)
            .unwrap()
            .is_empty()
    );
    assert!(
        wire.input(input("first", json!(fixtures()[1602].id)), &e)
            .unwrap()
            .is_empty()
    );
    assert!(
        wire.input(input("first", json!("x".repeat(257))), &e)
            .unwrap()
            .is_empty()
    );
    assert!(matches!(
        &wire
            .input(input("first", serde_json::Value::Null), &e)
            .unwrap()[..],
        [Input::Reading { id: None, .. }]
    ));
}
