#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{
    Engine,
    protocol::{Input, Query, Source},
};
use serde_json::{Value, json};
#[test]
fn followers_and_thread_continue_full_relay_pages() {
    for source in [Source::Followers, Source::Thread] {
        let mut e = Engine::new();
        e.input(
            Input::Configure {
                relays: vec![RELAY.into()],
            },
            0,
        );
        e.network
            .relay_information(RELAY, r#"{"limitation":{"max_limit":3}}"#);
        let target = "a".repeat(64);
        e.input(
            Input::Open {
                sub: "feed".into(),
                query: Query {
                    source,
                    target: Some(target.clone()),
                    ..Default::default()
                },
            },
            0,
        );
        e.network.connected(RELAY, 1);
        let req = frames(&mut e)
            .into_iter()
            .find(|f| {
                f[0] == "REQ"
                    && f[2][if source == Source::Followers {
                        "#p"
                    } else {
                        "#e"
                    }] == json!([target])
            })
            .expect("head");
        for at in [30, 20, 10] {
            let row = event(
                at,
                if source == Source::Followers { 3 } else { 1 },
                "",
                vec![vec![
                    if source == Source::Followers {
                        "p".into()
                    } else {
                        "e".into()
                    },
                    target.clone(),
                ]],
            );
            let row = e
                .network
                .message(RELAY, &json!(["EVENT", req[1], row]).to_string(), 2)
                .expect("event");
            e.enqueue(RELAY.into(), row);
        }
        e.network
            .message(RELAY, &json!(["EOSE", req[1]]).to_string(), 3);
        let mut requested = Vec::<Value>::new();
        for now in [4, 100, 200, 300] {
            e.tick(now);
            requested.extend(frames(&mut e));
        }
        assert!(
            requested
                .iter()
                .any(|f| f[0] == "REQ" && f[2]["until"] == 10),
            "{source:?}"
        );
    }
}
#[test]
fn thread_walk_has_no_hidden_five_hundred_row_limit() {
    let root = event(1, 1, "root", vec![]);
    let mut e = Engine::new();
    e.store.insert(root.clone(), None);
    for i in 0..510 {
        e.store.insert(
            event(2 + i, 1, "reply", vec![vec!["e".into(), root.id.clone()]]),
            None,
        );
    }
    assert_eq!(e.store.counts(&root.id).0, 510);
    assert_eq!(e.store.thread(&root.id).len(), 511);
}
#[test]
fn bookmark_lookup_does_not_abandon_ids_after_the_first_batch() {
    let mut e = Engine::new();
    let keys: Vec<_> = (1..=250).map(|i| format!("{i:064x}")).collect();
    let list = event(
        1,
        10003,
        "",
        keys.iter().map(|id| vec!["e".into(), id.clone()]).collect(),
    );
    let owner = list.pubkey.clone();
    e.store.insert(list, None);
    e.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    e.input(
        Input::Open {
            sub: "feed".into(),
            query: Query {
                source: Source::Bookmarks,
                account: Some(owner),
                ..Default::default()
            },
        },
        0,
    );
    e.network.connected(RELAY, 1);
    let mut sent = Vec::new();
    for now in [100, 200, 300, 400, 500, 600, 700, 800] {
        e.tick(now);
        let next = frames(&mut e);
        for frame in next.iter().filter(|f| f[0] == "REQ") {
            e.network
                .message(RELAY, &json!(["EOSE", frame[1]]).to_string(), now + 1);
        }
        sent.extend(next);
    }
    let ids: std::collections::BTreeSet<_> = sent
        .iter()
        .filter(|f| f[0] == "REQ")
        .flat_map(|f| f.as_array().expect("frame").iter().skip(2))
        .flat_map(|f| {
            f["ids"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
        })
        .collect();
    assert!(
        keys.iter().all(|key| ids.contains(key.as_str())),
        "ids {} frames {sent:?}",
        ids.len()
    );
}
#[test]
fn joined_channels_keep_members_after_one_thousand() {
    let mut e = Engine::new();
    let list = event(
        1,
        10005,
        "",
        (0..1200)
            .map(|i| vec!["e".into(), format!("{i:064x}")])
            .collect(),
    );
    let owner = list.pubkey.clone();
    e.store.insert(list, None);
    assert_eq!(
        lkjstr_core::engine::channels::joined(&e.store, Some(&owner)).len(),
        1200
    );
}
#[test]
fn bookmarks_do_not_claim_the_end_while_known_ids_are_unresolved() {
    use engine_review_support::{accept, output};
    use lkjstr_core::engine::wire::Session;
    let mut e = Engine::new();
    let note = event(1, 1, "cached", vec![]);
    let list = event(
        2,
        10003,
        "",
        vec![
            vec!["e".into(), note.id.clone()],
            vec!["e".into(), "f".repeat(64)],
        ],
    );
    let owner = list.pubkey.clone();
    e.store.insert(note, None);
    e.store.insert(list, None);
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"bookmarks","account":owner}}),
        0,
    );
    let out = output(&mut s, &mut e);
    assert_eq!(
        out.iter().find(|o| o["t"] == "rows").expect("rows")["atBottom"],
        false
    );
}
