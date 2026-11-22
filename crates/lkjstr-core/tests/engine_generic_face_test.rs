#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{accept, output};
use lkjstr_core::engine::{Engine, wire};
use lkjstr_protocol::{
    EventTemplate, NostrEntity, decode_nip19, finalize_event, generate_secret_key,
};
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
fn generic_face_is_classified_and_bounded_without_reordering_tags() {
    let key = generate_secret_key();
    let tags = (0..65)
        .map(|i| vec!["t".into(), format!("topic{i}")])
        .collect::<Vec<_>>();
    let mut alt = vec![vec!["alt".into(), "Public session".into()]];
    alt.extend(tags);
    let cases = [
        ("Hello from the session", "text"),
        (r#"{"server":"relay","count":4}"#, "data"),
        (&"z".repeat(160), "data"),
        ("", "empty"),
    ];
    for (i, (content, form)) in cases.iter().enumerate() {
        let event = signed(&key, 100 + i as u64, 30311, content, alt.clone());
        let mut engine = Engine::new();
        engine.store.insert(event.clone(), None);
        let found = rows(&mut engine, "thread", &event.id, None);
        let row = found.iter().find(|v| v["id"] == event.id).expect("focus");
        assert_eq!(row["face"]["type"], "generic");
        assert_eq!(row["face"]["alt"], "Public session");
        assert_eq!(row["face"]["form"], *form);
        assert_eq!(
            row["face"]["tags"].as_array().expect("fixture value").len(),
            64
        );
        assert_eq!(row["face"]["moreTags"], 2);
        assert_eq!(row["face"]["tags"][0]["name"], "alt");
        assert_eq!(row["face"]["tags"][1]["ref"]["tag"], "topic0");
        assert!(
            row["copyLink"]
                .as_str()
                .expect("fixture value")
                .starts_with("/a/naddr")
        );
        let encoded = row["copyLink"]
            .as_str()
            .expect("fixture value")
            .trim_start_matches("/a/");
        assert!(
            matches!(decode_nip19(encoded), Some(NostrEntity::Naddr(p)) if p.kind == 30311 && p.pubkey == event.pubkey)
        );
    }
}
#[test]
fn profile_all_retains_authored_act_identity_and_sorts_by_event_time() {
    let key = generate_secret_key();
    let note = signed(&key, 100, 1, "post", vec![]);
    let article = signed(
        &key,
        101,
        30023,
        "article",
        vec![vec!["d".into(), "article".into()]],
    );
    let list = signed(
        &key,
        102,
        30030,
        "emoji",
        vec![vec!["d".into(), "pack".into()]],
    );
    let other = signed(
        &key,
        103,
        30311,
        "meeting",
        vec![vec!["d".into(), "call".into()]],
    );
    let repost = signed(&key, 104, 6, "", vec![vec!["e".into(), note.id.clone()]]);
    let private = signed(&key, 105, 14, "secret", vec![]);
    let ephemeral = signed(&key, 106, 22000, "short", vec![]);
    let mut engine = Engine::new();
    for event in [
        &note, &article, &list, &other, &repost, &private, &ephemeral,
    ] {
        engine.store.insert(event.clone(), None);
    }
    let cases = [
        ("articles", vec![article.id.clone()]),
        ("lists", vec![list.id.clone()]),
        (
            "all",
            vec![
                repost.id.clone(),
                other.id.clone(),
                list.id.clone(),
                article.id.clone(),
                note.id.clone(),
            ],
        ),
    ];
    for (show, expected) in cases {
        let actual = rows(&mut engine, "profile", &note.pubkey, Some(show))
            .into_iter()
            .filter(|v| v["kind"] == "note")
            .map(|v| v["id"].as_str().expect("fixture value").to_owned())
            .collect::<Vec<_>>();
        assert_eq!(actual, expected, "profile mode {show}");
    }
}

#[test]
fn nip22_comments_attach_to_exact_generic_parent_and_retain_ancestors() {
    let key = generate_secret_key();
    let root = signed(
        &key,
        300,
        30311,
        "Session",
        vec![vec!["d".into(), "talk".into()]],
    );
    let wrong = signed(
        &key,
        301,
        30311,
        "Other session",
        vec![vec!["d".into(), "other".into()]],
    );
    let comment_tags = |parent: &lkjstr_protocol::NostrEvent| {
        vec![
            vec!["E".into(), root.id.clone()],
            vec!["K".into(), "30311".into()],
            vec!["e".into(), parent.id.clone()],
            vec!["k".into(), parent.kind.to_string()],
            vec!["P".into(), root.pubkey.clone()],
            vec!["p".into(), parent.pubkey.clone()],
        ]
    };
    let first = signed(&key, 302, 1111, "First", comment_tags(&root));
    let nested = signed(&key, 303, 1111, "Second", comment_tags(&first));
    let elsewhere = signed(&key, 304, 1111, "Elsewhere", comment_tags(&wrong));
    let arbitrary = signed(
        &key,
        305,
        30311,
        "Not a reply",
        vec![vec!["e".into(), root.id.clone()]],
    );
    let malformed = signed(
        &key,
        306,
        1111,
        "No K/k",
        vec![
            vec!["E".into(), root.id.clone()],
            vec!["e".into(), root.id.clone()],
        ],
    );
    let mut engine = Engine::new();
    for event in [
        &root, &wrong, &first, &nested, &elsewhere, &arbitrary, &malformed,
    ] {
        engine.store.insert(event.clone(), None);
    }
    let focus = rows(&mut engine, "thread", &root.id, None);
    let ids = focus
        .iter()
        .filter_map(|v| v["id"].as_str())
        .collect::<Vec<_>>();
    assert_eq!(
        ids,
        vec![root.id.as_str(), first.id.as_str(), nested.id.as_str()]
    );
    assert_eq!(focus[1]["thread"]["parent"], root.id);
    assert_eq!(focus[2]["thread"]["parent"], first.id);
    let nested_focus = rows(&mut engine, "thread", &nested.id, None);
    let ids = nested_focus
        .iter()
        .filter_map(|v| v["id"].as_str())
        .collect::<Vec<_>>();
    assert_eq!(
        ids,
        vec![root.id.as_str(), first.id.as_str(), nested.id.as_str()]
    );
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
