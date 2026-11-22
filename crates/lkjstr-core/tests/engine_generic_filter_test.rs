//! Legacy replies and NIP-22 roots keep separate relay predicates.
#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{RELAY, event, frames};
use lkjstr_core::engine::{
    Engine,
    protocol::{Input, Query, Source},
};
use serde_json::json;

#[test]
fn nip22_root_filters_do_not_narrow_legacy_replies_or_require_both_root_tags() {
    let mut engine = Engine::new();
    let root = event(
        1,
        30311,
        "public root",
        vec![vec!["d".into(), "room".into()]],
    );
    let coordinate = format!("30311:{}:room", root.pubkey);
    engine.store.insert(root.clone(), None);
    engine.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    engine.input(
        Input::Open {
            sub: "thread".into(),
            query: Query {
                source: Source::Thread,
                target: Some(root.id.clone()),
                ..Default::default()
            },
        },
        0,
    );
    engine.network.connected(RELAY, 1);
    engine.tick(100);
    let mut sent = frames(&mut engine);
    // Complete each issued history request so progressive startup can admit side reads.
    let mut answered = std::collections::HashSet::new();
    for step in 1..=12 {
        for frame in &sent {
            if frame[0] == "REQ"
                && let Some(id) = frame[1].as_str()
                && answered.insert(id.to_owned())
            {
                engine
                    .network
                    .message(RELAY, &json!(["EOSE", id]).to_string(), step * 500);
            }
        }
        engine.tick(step * 500);
        sent.extend(frames(&mut engine));
    }
    let filters: Vec<_> = sent
        .iter()
        .filter(|frame| frame[0] == "REQ")
        .flat_map(|frame| frame.as_array().expect("REQ").iter().skip(2))
        .collect();
    for (tag, value, kinds, absent) in [
        ("#e", root.id.clone(), json!([1, 42]), ["#E", "#A"]),
        ("#E", root.id, json!([1111]), ["#e", "#A"]),
        ("#A", coordinate, json!([1111]), ["#e", "#E"]),
    ] {
        let matching: Vec<_> = filters
            .iter()
            .filter(|filter| filter.get(tag) == Some(&json!([value])) && filter["kinds"] == kinds)
            .collect();
        assert!(
            !matching.is_empty(),
            "separate {tag} filter after completed startup: {filters:?}"
        );
        assert_eq!(matching[0]["kinds"], kinds, "{tag}");
        assert!(absent.iter().all(|other| matching[0].get(*other).is_none()));
        assert!(
            matching[0]["limit"]
                .as_u64()
                .is_some_and(|limit| limit <= 200)
        );
    }
    assert!(
        filters
            .iter()
            .all(|filter| filter.get("#E").is_none() || filter.get("#A").is_none())
    );
}
