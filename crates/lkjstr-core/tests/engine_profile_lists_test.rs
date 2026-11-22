//! Profile list relay selection must survive a prolific author's newer non-list history.
#![allow(clippy::expect_used)]
mod engine_review_support;
#[path = "cache_context/support.rs"]
mod support;
use engine_review_support::{accept, output};
use lkjstr_core::{
    engine::{
        Engine,
        protocol::{Filters, Query, Source},
        query, wire,
    },
    kinds::{Face, policy},
    store::Store,
};
use lkjstr_protocol::{NostrEvent, NostrFilter, generate_secret_key, matches_filter};
use serde_json::{Value, json};
use support::event;

fn lists(author: &str) -> Query {
    Query {
        source: Source::Profile,
        target: Some(author.into()),
        filters: Filters {
            show: Some("lists".into()),
            ..Default::default()
        },
        ..Default::default()
    }
}
fn relay_page(events: &[NostrEvent], filter: &NostrFilter) -> Vec<NostrEvent> {
    let mut matching = events
        .iter()
        .filter(|event| matches_filter(event, filter))
        .cloned()
        .collect::<Vec<_>>();
    matching.sort_by(|a, b| (b.created_at, &b.id).cmp(&(a.created_at, &a.id)));
    matching.truncate(filter.limit.unwrap_or(200) as usize);
    matching
}

#[test]
fn older_public_list_survives_more_than_200_newer_non_lists() {
    let key = generate_secret_key();
    let list = event(
        &key,
        30030,
        10,
        "",
        vec![vec!["d".into(), "older-list".into()]],
    );
    let mut history = vec![list.clone()];
    history.extend((0..205).map(|i| event(&key, 1, 100 + i, "newer post", vec![])));
    let q = lists(&list.pubkey);
    let filter = query::filter(&Store::new(1000), &q);
    assert_eq!(filter.limit, Some(200));
    // Causal refusal control: the former broad request consumes all 200 slots.
    let broad = NostrFilter {
        kinds: None,
        ..filter.clone()
    };
    let crowded = relay_page(&history, &broad);
    assert_eq!(crowded.len(), 200);
    assert!(crowded.iter().all(|event| event.kind == 1));
    let returned = relay_page(&history, &filter);
    assert_eq!(
        returned.len(),
        1,
        "only the older list belongs in the capped response"
    );
    assert_eq!(returned[0].id, list.id);
    let mut local = Store::new(1000);
    for event in history {
        local.insert(event, None);
    }
    assert_eq!(
        query::events(&local, &q)
            .iter()
            .map(|e| &e.id)
            .collect::<Vec<_>>(),
        [&list.id]
    );
}

#[test]
fn relay_list_kinds_equal_the_finite_public_policy() {
    let q = lists(&"1".repeat(64));
    let filter = query::filter(&Store::new(1), &q);
    let kinds = filter.kinds.expect("Lists must send a finite kinds filter");
    assert!(kinds.windows(2).all(|w| w[0] < w[1]));
    for kind in 0..=u16::MAX as u64 {
        let p = policy(kind);
        assert_eq!(
            kinds.contains(&kind),
            p.openable && p.face == Face::List,
            "kind {kind}"
        );
    }
    assert!(!kinds.contains(&65536));
    let all = Query {
        filters: Filters {
            show: Some("all".into()),
            ..Default::default()
        },
        ..q
    };
    assert!(query::filter(&Store::new(1), &all).kinds.is_none());
}

#[test]
fn public_lists_get_the_same_bounded_generic_face_as_the_mock() {
    let key = generate_secret_key();
    for (kind, content, form) in [(30030, "", "empty"), (10003, &"z".repeat(160), "data")] {
        let list = event(
            &key,
            kind,
            10,
            content,
            vec![
                vec!["d".into(), "pack".into()],
                vec!["title".into(), "Public list".into()],
            ],
        );
        let mut engine = Engine::new();
        engine.store.insert(list.clone(), None);
        let mut session = wire::Session::default();
        accept(
            &mut session,
            &mut engine,
            json!({"t":"open","sub":"lists","query":{
                "source":"profile","pubkey":list.pubkey,"show":"lists"
            }}),
            0,
        );
        let frames: Vec<Value> = output(&mut session, &mut engine);
        let row = frames
            .iter()
            .filter(|v| v["t"] == "rows")
            .flat_map(|v| v["rows"].as_array().expect("rows"))
            .find(|v| v["id"] == list.id)
            .expect("list row");
        assert_eq!(row["face"]["type"], "generic");
        assert_eq!(row["face"]["form"], form);
        assert_eq!(row["face"]["tags"][1]["text"], "Public list");
    }
}
