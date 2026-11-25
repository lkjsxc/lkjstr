#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{Engine, wire::Session};
use serde_json::{Value, json};
fn rows(e: &mut Engine, q: Value, window: Option<Value>) -> Vec<Value> {
    let mut s = Session::default();
    accept(&mut s, e, json!({"t":"open","sub":"feed","query":q}), 0);
    if let Some(w) = window {
        accept(&mut s, e, w, 1);
    }
    output(&mut s, e)
        .into_iter()
        .rev()
        .find(|m| m["t"] == "rows")
        .expect("rows")["rows"]
        .as_array()
        .expect("array")
        .clone()
}
#[test]
fn rich_filters_words_phrases_exclusions_media_names_and_inclusive_days() {
    let mut good = event(
        20,
        1,
        "猫 blue 静かな 朝 https://test.local/a.png https://test.local/page",
        vec![],
    );
    let profile = event(10, 0, "", vec![]);
    good.pubkey = profile.pubkey.clone();
    let mut meta = profile.clone();
    meta.content = r#"{"name":"aoi","nip05":"aoi@example.com"}"#.into();
    let mut spam = good.clone();
    spam.id = "14".repeat(32);
    spam.content += " SPAM";
    let mut e = Engine::new();
    for v in [meta, good.clone(), spam] {
        assert_eq!(e.store.insert(v, None), lkjstr_core::store::Inserted::New);
    }
    let q = json!({"source":"search","text":"blue 猫","phrases":["静かな 朝"],"exclude":["spam"],"has":["image","link"],"from":["aoi"],"since":20000,"until":20999});
    assert_eq!(
        rows(&mut e, q.clone(), None)
            .iter()
            .map(|r| r["id"].clone())
            .collect::<Vec<_>>(),
        vec![json!(good.id)]
    );
    for (field, value) in [
        ("from", json!(["nobody"])),
        ("has", json!(["video"])),
        ("since", json!(20001)),
        ("until", json!(19999)),
        ("phrases", json!(["静かな朝"])),
    ] {
        let mut q = q.clone();
        q[field] = value;
        assert!(rows(&mut e, q, None).is_empty(), "{field}");
    }
    for from in [
        json!([lkjstr_protocol::encode_npub(&good.pubkey).expect("npub")]),
        json!(["aoi@example.com"]),
        json!([
            lkjstr_protocol::encode_nprofile(&lkjstr_protocol::ProfilePointer {
                pubkey: good.pubkey.clone(),
                relays: None
            })
            .expect("nprofile")
        ]),
    ] {
        assert_eq!(
            rows(
                &mut e,
                json!({"source":"search","from":from,"exclude":["spam"]}),
                None
            )
            .len(),
            1
        );
    }
    assert_eq!(rows(&mut e,json!({"source":"global","from":["unknown"],"authors":[good.pubkey],"exclude":["spam"]}),None).len(),1);
}
#[test]
fn profile_kinds_project_targets_and_order_by_actor_time() {
    let mut e = Engine::new();
    let post = event(10, 1, "post https://local.test/a.png", vec![]);
    let mut reply = event(
        20,
        1,
        "reply",
        vec![vec!["e".into(), post.id.clone(), "".into(), "reply".into()]],
    );
    reply.pubkey = post.pubkey.clone();
    let target = event(1, 1, "target", vec![]);
    let target2 = event(2, 1, "target2", vec![]);
    let mut repost = event(40, 16, "", vec![vec!["e".into(), target.id.clone()]]);
    repost.pubkey = post.pubkey.clone();
    let mut reaction = event(30, 7, "+", vec![vec!["e".into(), target2.id.clone()]]);
    reaction.pubkey = post.pubkey.clone();
    let mut reaction2 = event(50, 7, "+", vec![vec!["e".into(), target.id.clone()]]);
    reaction2.pubkey = post.pubkey.clone();
    for v in [
        &post, &reply, &target, &target2, &repost, &reaction, &reaction2,
    ] {
        e.store.insert(v.clone(), None);
    }
    for (kind, ids) in [
        ("posts", vec![&post.id]),
        ("replies", vec![&reply.id]),
        ("media", vec![&post.id]),
        ("reposts", vec![&target.id]),
        ("reactions", vec![&target.id, &target2.id]),
    ] {
        let found = rows(
            &mut e,
            json!({"source":"profile","pubkey":post.pubkey,"show":kind}),
            None,
        );
        assert_eq!(found[0]["kind"], "profile");
        assert_eq!(
            found[1..]
                .iter()
                .map(|r| r["id"].as_str().expect("id"))
                .collect::<Vec<_>>(),
            ids.iter().map(|s| s.as_str()).collect::<Vec<_>>(),
            "{kind}"
        );
        if kind == "reposts" {
            assert_eq!(found[1]["repostedBy"]["actors"][0]["pubkey"], post.pubkey);
            assert_eq!(found[1]["repostedBy"]["at"], 40000);
        }
    }
    assert_eq!(
        rows(
            &mut e,
            json!({"source":"profile","pubkey":post.pubkey}),
            None
        )
        .len(),
        3
    );
}
#[test]
fn mixed_notifications_are_identical_sorted_and_deduplicated() {
    let mut e = Engine::new();
    let post = event(10, 1, "post", vec![]);
    let reaction = event(
        20,
        7,
        "+",
        vec![
            vec!["p".into(), post.pubkey.clone()],
            vec!["e".into(), post.id.clone()],
        ],
    );
    let reply = event(
        30,
        1,
        "mention",
        vec![vec!["p".into(), post.pubkey.clone()]],
    );
    for v in [&post, &reaction, &reply] {
        e.store.insert(v.clone(), None);
    }
    let news = rows(
        &mut e,
        json!({"source":"notifications","account":post.pubkey}),
        None,
    );
    let mixed = rows(
        &mut e,
        json!({"source":"global","account":post.pubkey,"notifications":true}),
        None,
    );
    assert_eq!(mixed.len(), 3);
    assert_eq!(mixed[0]["id"], reply.id);
    assert_eq!(
        mixed[1],
        *news
            .iter()
            .find(|r| r["type"] == "reaction")
            .expect("reaction")
    );
    assert_eq!(mixed[2]["id"], post.id);
    assert_eq!(
        rows(
            &mut e,
            json!({"source":"global","account":post.pubkey}),
            None
        )
        .len(),
        2
    );
}
#[test]
fn windows_keep_five_hundred_read_notes_and_accept_eight_hundred() {
    let mut e = Engine::new();
    e.signed_out_global_filter = false;
    for i in 1..=850 {
        e.store.insert(event(i, 1, "window", vec![]), None);
    }
    let all = rows(
        &mut e,
        json!({"source":"global"}),
        Some(json!({"t":"window","sub":"feed","anchor":"top","before":0,"after":800})),
    );
    assert_eq!(all.len(), 800);
    let kept = rows(
        &mut e,
        json!({"source":"global"}),
        Some(
            json!({"t":"window","sub":"feed","anchor":{"key":all[499]["key"]},"before":800,"after":100}),
        ),
    );
    assert_eq!(kept.len(), 599);
    assert_eq!(kept[0]["key"], all[0]["key"]);
}
#[test]
fn nip05_query_lookup_verifies_evidence_and_replans_authors() {
    let mut e = Engine::new();
    let note = event(10, 1, "resolved", vec![]);
    e.store.insert(note.clone(), None);
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"search","from":["aoi@example.com"]}}),
        0,
    );
    assert!(
        e.identity_wants()
            .contains(&("from:aoi@example.com".into(), "aoi@example.com".into()))
    );
    e.identity_result(
        "from:aoi@example.com",
        "aoi@example.com",
        lkjstr_nips::identity::HttpResponse {
            status: 200,
            final_url: "https://example.com/.well-known/nostr.json?name=aoi".into(),
            body: json!({"names":{"aoi":note.pubkey}}).to_string(),
        },
    );
    assert_eq!(
        rows(
            &mut e,
            json!({"source":"search","from":["aoi@example.com"]}),
            None
        )[0]["id"],
        note.id
    );
}
