#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{accept, output};
use lkjstr_core::engine::{Engine, wire};
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};
use serde_json::{Value, json};

fn signed(
    key: &lkjstr_protocol::SecretKeyBytes,
    at: u64,
    kind: u64,
    text: &str,
    tags: Vec<Vec<String>>,
) -> lkjstr_protocol::NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            content: text.into(),
            tags,
        },
        key,
    )
    .expect("signed fixture")
}
fn rows(engine: &mut Engine, source: &str, target: &str, show: Option<&str>) -> Vec<Value> {
    let mut session = wire::Session::default();
    let q = if source == "profile" {
        json!({"source":source,"pubkey":target,"show":show})
    } else {
        json!({"source":source,"id":target})
    };
    accept(
        &mut session,
        engine,
        json!({"t":"open","sub":"generic","query":q}),
        0,
    );
    output(&mut session, engine)
        .into_iter()
        .rev()
        .find(|v| v["t"] == "rows" && v["sub"] == "generic")
        .expect("rows frame")["rows"]
        .as_array()
        .expect("rows array")
        .clone()
}
#[test]
fn repost_and_reaction_tags_follow_target_kind_without_duplicate_k() {
    for (kind, repost_kind) in [(1, 6), (42, 16), (30311, 16)] {
        let key = generate_secret_key();
        let parent = signed(&key, 100, kind, "Public target", vec![]);
        let mut engine = Engine::new();
        engine.store.insert(parent.clone(), None);
        let mut session = wire::Session::default();
        for (label, what, expected_kind) in [
            ("repost", json!({"k":"repost","id":parent.id}), repost_kind),
            (
                "reaction",
                json!({"k":"reaction","id":parent.id,"emoji":"❤️"}),
                7,
            ),
        ] {
            accept(
                &mut session,
                &mut engine,
                json!({"t":"act","req":label,
                "action":{"a":"publish","as":parent.pubkey,"what":what}}),
                100_000,
            );
            let frames = output(&mut session, &mut engine);
            let sign = frames
                .iter()
                .find(|frame| frame["t"] == "sign")
                .expect("sign");
            let event: Value = serde_json::from_str(sign["event"].as_str().expect("fixture value"))
                .expect("fixture value");
            assert_eq!(event["kind"], expected_kind, "{label} target {kind}");
            let tags = event["tags"].as_array().expect("fixture value");
            assert_eq!(
                tags.iter()
                    .filter(|tag| tag[0] == "e" && tag[1] == parent.id)
                    .count(),
                1
            );
            assert_eq!(
                tags.iter()
                    .filter(|tag| tag[0] == "p" && tag[1] == parent.pubkey)
                    .count(),
                1
            );
            assert_eq!(
                tags.iter().filter(|tag| tag[0] == "k").count(),
                usize::from(kind != 1 || label == "reaction")
            );
            if kind != 1 || label == "reaction" {
                assert!(
                    tags.iter()
                        .any(|tag| tag[0] == "k"
                            && tag[1].as_str() == Some(kind.to_string().as_str()))
                );
            }
        }
    }
}

#[test]
fn nip22_invalid_parent_kind_never_links_and_address_scope_requires_exact_coordinate() {
    let key = generate_secret_key();
    let root = signed(
        &key,
        10,
        30311,
        "The public root",
        vec![vec!["d".into(), "room".into()]],
    );
    let different = signed(
        &key,
        11,
        30311,
        "Other room",
        vec![vec!["d".into(), "other".into()]],
    );
    let address = format!("30311:{}:room", root.pubkey);
    let comment = signed(
        &key,
        12,
        1111,
        "Address parent",
        vec![
            vec!["A".into(), address.clone()],
            vec!["K".into(), "30311".into()],
            vec!["a".into(), address],
            vec!["k".into(), "30311".into()],
        ],
    );
    let wrong = signed(
        &key,
        13,
        1111,
        "Wrong k",
        vec![
            vec!["E".into(), root.id.clone()],
            vec!["K".into(), "30311".into()],
            vec!["e".into(), root.id.clone()],
            vec!["k".into(), "1".into()],
        ],
    );
    let forbidden = signed(
        &key,
        14,
        1111,
        "Private kind root",
        vec![
            vec!["E".into(), root.id.clone()],
            vec!["K".into(), "30311".into()],
            vec!["e".into(), root.id.clone()],
            vec!["k".into(), "14".into()],
        ],
    );
    let mut engine = Engine::new();
    for event in [&root, &different, &comment, &wrong, &forbidden] {
        engine.store.insert(event.clone(), None);
    }
    let found = rows(&mut engine, "thread", &root.id, None);
    let ids = found
        .iter()
        .filter_map(|row| row["id"].as_str())
        .collect::<Vec<_>>();
    assert_eq!(ids, vec![root.id.as_str(), comment.id.as_str()]);
    let sibling = rows(&mut engine, "thread", &different.id, None);
    assert_eq!(sibling.len(), 1);
}
