#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;

use engine_review_support::{RELAY, accept, event, frames, output};
use lkjstr_core::engine::{Engine, protocol::Input, wire::Session};
use serde_json::{Value, json};

fn people(s: &mut Session, e: &mut Engine, sub: &str, query: Value) -> Vec<String> {
    accept(s, e, json!({"t":"open","sub":sub,"query":query}), 0);
    accept(
        s,
        e,
        json!({"t":"window","sub":sub,"anchor":"top","before":0,"after":6}),
        0,
    );
    output(s, e)
        .into_iter()
        .rev()
        .find(|row| row["t"] == "rows" && row["sub"] == sub)
        .expect("people rows")["rows"]
        .as_array()
        .expect("row array")
        .iter()
        .map(|row| row["author"]["pubkey"].as_str().expect("pubkey").to_owned())
        .collect()
}

#[test]
fn bare_mention_uses_bounded_follow_and_context_candidates_and_hydrates_them() {
    let mut e = Engine::new();
    let target = event(1, 1, "reply or quote target", vec![]);
    let root_reply = vec!["e".into(), target.id.clone(), String::new(), "root".into()];
    let participant = event(2, 1, "participant", vec![root_reply.clone()]);
    let following: Vec<String> = (1..=7).map(|i| format!("{i:064x}")).collect();
    let own = event(3, 1, "own reply", vec![root_reply]);
    let account = own.pubkey.clone();
    let tags = following
        .iter()
        .chain([&account, &target.pubkey, &following[0]])
        .map(|key| vec!["p".into(), key.clone()])
        .collect();
    let mut follows = event(4, 3, "", tags);
    follows.pubkey.clone_from(&account);
    for v in [
        target.clone(),
        participant.clone(),
        own,
        follows,
        event(5, 0, r#"{"name":"unrelated"}"#, vec![]),
    ] {
        e.store.insert(v, None);
    }
    let mut s = Session::default();
    assert_eq!(
        people(
            &mut s,
            &mut e,
            "bare-without-context",
            json!({"source":"people","text":""}),
        ),
        Vec::<String>::new()
    );
    assert_eq!(
        people(
            &mut s,
            &mut e,
            "post",
            json!({"source":"people","text":"","account":account}),
        ),
        following[..6]
    );
    e.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    let expected: Vec<_> = [target.pubkey, participant.pubkey]
        .into_iter()
        .chain(following[..4].iter().cloned())
        .collect();
    assert_eq!(
        people(
            &mut s,
            &mut e,
            "inline-or-quote",
            json!({"source":"people","text":"","account":account,"id":target.id}),
        ),
        expected
    );
    accept(
        &mut s,
        &mut e,
        json!({"t":"hint","hint":{"visibleSubs":["inline-or-quote"],"pageHidden":false}}),
        0,
    );
    e.network.connected(RELAY, 1);
    e.tick(100);
    let mut wanted: Vec<_> = frames(&mut e)
        .into_iter()
        .filter(|frame| frame[0] == "REQ")
        .flat_map(|frame| frame.as_array().expect("REQ frame")[2..].to_vec())
        .filter(|filter| filter["kinds"] == json!([0]))
        .flat_map(|filter| {
            filter["authors"]
                .as_array()
                .expect("targeted authors")
                .clone()
        })
        .map(|key| key.as_str().expect("author").to_owned())
        .collect();
    wanted.sort();
    wanted.dedup();
    let mut expected = expected;
    expected.sort();
    assert_eq!(wanted, expected);
}
