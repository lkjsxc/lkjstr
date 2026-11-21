#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{accept, event, output};
use lkjstr_core::engine::{Engine, wire};
use serde_json::{Value, json};

fn rows(messages: &[Value]) -> Vec<String> {
    messages.iter().find(|m| m["t"] == "rows").expect("window")["rows"]
        .as_array()
        .expect("rows")
        .iter()
        .map(|row| row["key"].as_str().expect("key").to_owned())
        .collect()
}

#[test]
fn a_top_window_keeps_the_delivered_tail_and_grows_as_arrivals_prepend() {
    let mut engine = Engine::new();
    let mut wire = wire::Session::default();
    engine.signed_out_global_filter = false;
    let template = event(1, 1, "retained body", vec![]);
    for at in 1..=950 {
        let mut value = template.clone();
        value.created_at = at;
        value.id = format!("{at:064x}");
        engine.store.insert(value, None);
    }
    accept(
        &mut wire,
        &mut engine,
        json!({"t":"open","sub":"feed","query":{"source":"global"}}),
        0,
    );
    output(&mut wire, &mut engine);
    accept(
        &mut wire,
        &mut engine,
        json!({"t":"window","sub":"feed","anchor":{"key":format!("{:064x}", 80)},"before":800,"after":60,"retainAbove":true}),
        1,
    );
    let previously_loaded = rows(&output(&mut wire, &mut engine));
    assert_eq!(previously_loaded.len(), 930);
    let tail = previously_loaded.last().expect("tail");
    accept(
        &mut wire,
        &mut engine,
        json!({"t":"window","sub":"feed","anchor":"top","headThrough":tail,"before":0,"after":60}),
        2,
    );
    assert_eq!(rows(&output(&mut wire, &mut engine)), previously_loaded);
    let arrival = event(951, 1, "new arrival", vec![]);
    let id = arrival.id.clone();
    engine.enqueue("cache".into(), arrival);
    engine.tick(100);
    let updates = output(&mut wire, &mut engine);
    assert!(updates.iter().any(|msg| msg["t"] == "patch"
        && msg["ops"].as_array().is_some_and(|ops| {
            ops.iter().any(|op| {
                op["op"] == "insert"
                    && op["before"] == previously_loaded[0]
                    && op["rows"][0]["key"] == id
            }) && !ops.iter().any(|op| op["op"] == "drop")
        })));
    accept(
        &mut wire,
        &mut engine,
        json!({"t":"window","sub":"feed","anchor":"top","headThrough":tail,"before":0,"after":60}),
        101,
    );
    let current = rows(&output(&mut wire, &mut engine));
    assert_eq!(current[0], id);
    assert_eq!(&current[1..], previously_loaded);
}
