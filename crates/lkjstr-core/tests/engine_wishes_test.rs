#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{Engine, protocol, wire::Session};
use serde_json::{Value, json};
fn messages(s: &mut Session, e: &mut Engine, q: Value) -> Vec<Value> {
    accept(s, e, json!({"t":"open","sub":"wish","query":q}), 0);
    accept(
        s,
        e,
        json!({"t":"window","sub":"wish","anchor":"top","before":0,"after":60}),
        1,
    );
    output(s, e)
}
fn rows(messages: Vec<Value>) -> Vec<Value> {
    messages
        .into_iter()
        .rev()
        .find(|v| v["t"] == "rows")
        .expect("rows")["rows"]
        .as_array()
        .expect("array")
        .clone()
}
#[test]
fn likes_share_a_chip_and_toggle_deletes_all_own_aliases() {
    let note = event(1, 1, "target", vec![]);
    let mut e = Engine::new();
    e.store.insert(note.clone(), None);
    for (i, content) in ["+", "", "❤️", "-"].iter().enumerate() {
        let mut reaction = event(
            2 + i as u64,
            7,
            content,
            vec![vec!["e".into(), note.id.clone()]],
        );
        reaction.pubkey = note.pubkey.clone();
        e.store.insert(reaction, None);
    }
    let row = lkjstr_core::engine::rows::row(&e.store, &note, Some(&note.pubkey), 0);
    let heart = row
        .reactions
        .iter()
        .find(|r| r.content == "❤️")
        .expect("heart");
    assert_eq!(heart.count, 3);
    assert!(heart.mine);
    assert!(row.reactions.iter().any(|r| r.content == "👎"));
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"act","req":"delete","action":{"a":"publish","as":note.pubkey,"what":{"k":"delete","id":note.id,"of":"reaction","emoji":"❤️"}}}),
        10000,
    );
    let frames = output(&mut s, &mut e);
    let sign = frames.iter().find(|v| v["t"] == "sign").expect("sign");
    let signed: Value = serde_json::from_str(sign["event"].as_str().expect("event")).expect("json");
    assert_eq!(
        signed["tags"]
            .as_array()
            .expect("tags")
            .iter()
            .filter(|t| t[0] == "e")
            .count(),
        3
    );
}
#[test]
fn their_home_is_independent_of_reader_and_tracks_replaced_follows() {
    let owner = "aa".repeat(32);
    let other = "bb".repeat(32);
    let a = event(1, 1, "followed", vec![]);
    let mut b = event(2, 1, "other", vec![]);
    b.pubkey = other.clone();
    let mut follow = event(3, 3, "", vec![vec!["p".into(), a.pubkey.clone()]]);
    follow.pubkey = owner.clone();
    let mut e = Engine::new();
    for v in [a.clone(), b.clone(), follow.clone()] {
        e.store.insert(v, None);
    }
    let q = json!({"source":"their-home","pubkey":owner});
    assert_eq!(
        rows(messages(&mut Session::default(), &mut e, q.clone()))[0]["id"],
        a.id
    );
    follow.created_at += 1;
    follow.id = "new-list".into();
    follow.tags = vec![vec!["p".into(), other]];
    e.store.insert(follow.clone(), None);
    assert_eq!(
        rows(messages(&mut Session::default(), &mut e, q.clone()))[0]["id"],
        b.id
    );
    follow.created_at += 1;
    follow.id = "empty-list".into();
    follow.tags.clear();
    e.store.insert(follow, None);
    assert!(rows(messages(&mut Session::default(), &mut e, q)).is_empty());
}
#[test]
fn device_mentions_rank_follows_then_thread_and_normalize_kana_width() {
    let mut e = Engine::new();
    let me = "aa".repeat(32);
    let mut thread = event(20, 1, "reply context", vec![]);
    thread.pubkey = "cc".repeat(32);
    for (i, key) in ["bb", "cc", "dd"].iter().enumerate() {
        let mut profile = event(
            1 + i as u64,
            0,
            r#"{"name":"カタカナ","display_name":"Katakana","nip05":"_@Kana.Example"}"#,
            vec![],
        );
        profile.pubkey = key.repeat(32);
        e.store.insert(profile, None);
    }
    let mut follows = event(5, 3, "", vec![vec!["p".into(), "dd".repeat(32)]]);
    follows.pubkey = me.clone();
    e.store.insert(follows, None);
    e.store.insert(thread.clone(), None);
    for needle in ["ｶﾀ", "KAT", "kana"] {
        let r = rows(messages(
            &mut Session::default(),
            &mut e,
            json!({"source":"people","text":needle,"account":me,"id":thread.id}),
        ));
        assert_eq!(
            r.iter()
                .map(|r| r["author"]["pubkey"].as_str().expect("key"))
                .collect::<Vec<_>>(),
            vec!["dd".repeat(32), "cc".repeat(32), "bb".repeat(32)]
        );
    }
}
#[test]
fn selected_utf16_mentions_expand_only_while_the_name_is_unchanged() {
    let e = Engine::new();
    let key = "aa".repeat(32);
    let mut s = Session::default();
    let npub = lkjstr_protocol::encode_npub(&key).expect("npub");
    for (text, expected) in [
        ("🌿 @Alice hi", format!("🌿 nostr:{npub} hi")),
        ("🌿 @Alicia hi", "🌿 @Alicia hi".into()),
    ] {
        let input = serde_json::from_value(json!({"t":"act","req":"mention","action":{"a":"publish","as":key,"what":{"k":"note","draft":{"text":text,"mentions":[{"start":3,"end":9,"pubkey":key,"label":"@Alice"}]}}}})).expect("input");
        let p = s.input(input, &e).expect("translate");
        assert!(
            matches!(&p[0], protocol::Input::Action { action:protocol::Action::Publish { content,.. },..} if content==&expected)
        );
    }
}
#[test]
fn notification_fresh_counts_visible_groups_and_omits_own_acts() {
    let mut e = Engine::new();
    let mut target = event(1, 1, "own", vec![]);
    target.pubkey = "aa".repeat(32);
    let me = target.pubkey.clone();
    e.store.insert(target.clone(), None);
    for (at, key, content) in [
        (2, "bb", "+"),
        (3, "cc", ""),
        (4, "dd", "❤️"),
        (5, "aa", "+"),
    ] {
        let mut r = event(
            at,
            7,
            content,
            vec![
                vec!["e".into(), target.id.clone()],
                vec!["p".into(), me.clone()],
                vec![
                    "emoji".into(),
                    "cat".into(),
                    "https://example.test/cat.png".into(),
                ],
            ],
        );
        r.tags.push(vec![
            "emoji".into(),
            "cat".into(),
            "https://example.test/cat.png".into(),
        ]);
        r.pubkey = key.repeat(32);
        e.store.insert(r, None);
    }
    let mut s = Session::default();
    let r = rows(messages(
        &mut s,
        &mut e,
        json!({"source":"notifications","account":me,"types":["reaction"]}),
    ));
    assert_eq!(r.len(), 1);
    assert_eq!(r[0]["actors"].as_array().expect("actors").len(), 3);
    assert_eq!(r[0]["emoji"]["emoji"], "❤️");
    assert!(r[0]["emoji"].get("url").is_none());
    let anchor = r[0]["key"].clone();
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"wish","anchor":{"key":anchor},"before":200,"after":60}),
        10,
    );
    output(&mut s, &mut e);
    let mut reply = event(8, 1, "new reply", vec![vec!["p".into(), me]]);
    reply.pubkey = "ee".repeat(32);
    e.store.insert(reply, None);
    let out = s.output(
        protocol::Output::Fresh {
            sub: "wish".into(),
            count: 99,
        },
        &e,
    );
    assert!(
        serde_json::to_value(out)
            .expect("json")
            .as_array()
            .expect("array")
            .iter()
            .any(|v| v["t"] == "fresh" && v["count"] == 0)
    );
    let mut arrival = event(
        9,
        7,
        "+",
        vec![
            vec!["p".into(), target.pubkey.clone()],
            vec!["e".into(), "ff".repeat(32)],
        ],
    );
    arrival.pubkey = "cc".repeat(32);
    e.store.insert(arrival, None);
    let out = s.output(
        protocol::Output::Fresh {
            sub: "wish".into(),
            count: 100,
        },
        &e,
    );
    assert!(
        serde_json::to_value(out)
            .expect("json")
            .as_array()
            .expect("array")
            .iter()
            .any(|v| v["t"] == "fresh" && v["count"] == 1)
    );
}
