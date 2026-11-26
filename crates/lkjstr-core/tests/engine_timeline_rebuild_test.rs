#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{accept, event, output};
use lkjstr_core::engine::{Engine, wire::Session};
use serde_json::{Value, json};

const NOW: u64 = 1800000000000;
fn last_timeline(s: &mut Session, e: &Engine, from: u64, turns: u64) -> Option<Value> {
    let mut result = None;
    for i in 0..turns {
        for out in s.timeline_tick(e, from + i * 25) {
            result = Some(serde_json::to_value(out).expect("timeline")["timeline"].clone());
        }
    }
    result
}
fn has(data: &Value, key: &str) -> bool {
    data["positions"]
        .as_array()
        .expect("positions")
        .iter()
        .any(|p| p["key"] == key)
}
/// A window that changes while the index rebuilds (older history arrived) still gets positions for
/// rows the previous finished index knew, without waiting for the whole rebuild.
#[test]
fn window_positions_follow_while_the_index_rebuilds() {
    let mut e = Engine::new();
    let mut s = Session::default();
    let base = event(1700000000, 1, "cached", vec![]);
    for i in 0..6000 {
        let mut note = base.clone();
        note.id = format!("{i:064x}");
        note.created_at += i;
        e.store.insert(note, None);
    }
    let open = json!({"t":"open","sub":"s","query":{"source":"home","account":base.pubkey}});
    accept(&mut s, &mut e, open, 0);
    let top = json!({"t":"window","sub":"s","anchor":"top","before":0,"after":20});
    accept(&mut s, &mut e, top, 0);
    output(&mut s, &mut e);
    let first = last_timeline(&mut s, &e, NOW, 200).expect("first timeline");
    assert!(has(&first, &format!("{:064x}", 5999)));
    // Older history lands: the store revision changes and the index starts again.
    let mut old = base.clone();
    old.id = format!("{:064x}", 90000);
    old.created_at = 1600000000;
    e.store.insert(old, None);
    let deep = format!("{:064x}", 10);
    let window = json!({"t":"window","sub":"s","anchor":{"key":deep},"before":0,"after":20});
    accept(&mut s, &mut e, window, 0);
    output(&mut s, &mut e);
    let soon = last_timeline(&mut s, &e, NOW + 10000, 8).expect("a prompt timeline");
    assert!(
        has(&soon, &deep),
        "the moved window has positions before the rebuild ends"
    );
}
