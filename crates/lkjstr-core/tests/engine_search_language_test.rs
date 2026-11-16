#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{accept, event, output};
use lkjstr_core::{
    engine::{
        Engine, protocol, query,
        wire::{Session, queries::Query},
    },
    store::Store,
};
use serde_json::{Value, json};
use std::collections::BTreeSet;

fn selected(store: &Store, language: Value) -> BTreeSet<String> {
    let query: Query = serde_json::from_value(json!({
        "source":"global","language":language
    }))
    .expect("query");
    query::events(store, &query.convert().expect("conversion"))
        .into_iter()
        .map(|event| event.id.clone())
        .collect()
}
#[test]
fn every_requested_language_participates_in_the_union() {
    let english = event(100, 1, "Only English words", vec![]);
    let japanese = event(101, 1, "日本語の文章", vec![]);
    let mixed = event(102, 1, "English and 日本語", vec![]);
    let other = event(103, 1, "12345", vec![vec!["l".into(), "zz".into()]]);
    let mut store = Store::new(100);
    for value in [&english, &japanese, &mixed, &other] {
        store.insert(value.clone(), None);
    }
    let union: BTreeSet<_> = [&english, &japanese, &mixed].map(|e| e.id.clone()).into();
    assert_eq!(selected(&store, json!(["en", "ja"])), union);
    assert_eq!(selected(&store, json!(["ja", "en"])), union);
    assert_eq!(selected(&store, json!(["en", "ja", "en"])), union);
    let tagged: BTreeSet<_> = [&japanese, &mixed, &other].map(|e| e.id.clone()).into();
    assert_eq!(selected(&store, json!(["zz", "ja"])), tagged);
    assert_eq!(selected(&store, json!([])).len(), 4);
    assert_eq!(selected(&store, Value::Null).len(), 4);
    assert!(selected(&store, json!(["unmatched"])).is_empty());
    let scalar = protocol::Query {
        source: protocol::Source::Global,
        filters: protocol::Filters {
            language: Some("en".into()),
            ..Default::default()
        },
        ..Default::default()
    };
    let ids: BTreeSet<_> = query::events(&store, &scalar)
        .iter()
        .map(|e| e.id.clone())
        .collect();
    assert_eq!(ids, [&english, &mixed].map(|e| e.id.clone()).into());
}
#[test]
fn window_membership_and_time_rail_share_the_language_union() {
    let english = event(1_700_000_000, 1, "Only English words", vec![]);
    let japanese = event(1_700_000_001, 1, "日本語の文章", vec![]);
    let mut engine = Engine::new();
    for value in [&english, &japanese] {
        engine.store.insert(value.clone(), None);
    }
    let mut session = Session::default();
    accept(
        &mut session,
        &mut engine,
        json!({
            "t":"open","sub":"s","query":{"source":"global","account":english.pubkey,"language":["en","ja"]}
        }),
        0,
    );
    accept(
        &mut session,
        &mut engine,
        json!({
            "t":"window","sub":"s","anchor":"top","before":0,"after":2
        }),
        0,
    );
    let messages = output(&mut session, &mut engine);
    let rows = messages
        .iter()
        .rev()
        .find(|m| m["t"] == "rows")
        .expect("rows")["rows"]
        .as_array()
        .expect("rows array");
    let ids: BTreeSet<_> = rows.iter().filter_map(|r| r["id"].as_str()).collect();
    assert_eq!(ids, [english.id.as_str(), japanese.id.as_str()].into());
    let mut last = Value::Null;
    for step in 0..100 {
        for message in session.timeline_tick(&engine, 1_800_000_000_000 + step * 25) {
            last = serde_json::to_value(message).expect("timeline")["timeline"].clone();
        }
    }
    assert_eq!(last["supported"], true);
    let total: u64 = last["months"]
        .as_array()
        .expect("months")
        .iter()
        .map(|m| m["count"].as_u64().expect("count"))
        .sum();
    assert_eq!(total, 2);
    assert_eq!(last["positions"].as_array().expect("positions").len(), 2);
}
