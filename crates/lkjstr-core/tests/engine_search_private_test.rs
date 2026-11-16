#![allow(clippy::unwrap_used)]
mod engine_search_support;
use engine_search_support::*;
use serde_json::{Value, json};
use std::collections::BTreeSet;

fn fixture() -> Fixture {
    let mute = event(
        1,
        10000,
        100,
        "encrypted fixture",
        vec![vec!["p".into(), pubkey(3)]],
    );
    let mut f = Fixture::new(vec![
        mute.clone(),
        profile(2, 100, "alice blue", "", ""),
        profile(3, 100, "alice blue", "", ""),
        profile(4, 100, "alice blue", "", ""),
        note(8, 1_700_000_000),
    ]);
    f.engine
        .private_lists
        .insert(mute.id, vec![vec!["p".into(), pubkey(2)]]);
    f
}
fn keys(f: &Fixture) -> BTreeSet<String> {
    f.people()
        .into_iter()
        .map(|p| p["author"]["pubkey"].as_str().unwrap().to_owned())
        .collect()
}
#[test]
fn cached_private_person_mutes_belong_only_to_the_query_account() {
    let mut f = fixture();
    f.open(1);
    assert_eq!(keys(&f), [pubkey(4)].into());
    f.open(9);
    assert_eq!(keys(&f), [pubkey(2), pubkey(3), pubkey(4)].into());
    f.input(json!({"t":"open","sub":"s","query":{"source":"search","text":"alice blue"}}));
    f.input(json!({"t":"window","sub":"s","anchor":"top","before":0,"after":3}));
    assert_eq!(keys(&f), [pubkey(2), pubkey(3), pubkey(4)].into());
}
#[test]
fn hidden_search_projection_is_rebuilt_when_private_authority_is_revoked() {
    let mut f = fixture();
    f.open(1);
    assert_eq!(keys(&f), [pubkey(4)].into());
    f.input(json!({"t":"hint","hint":{
        "visibleSubs":[],"pageHidden":false,"idle":false,"saveData":false
    }}));
    let replacement = f
        .engine
        .retain_private_accounts(&BTreeSet::new(), f.now + 1, true)
        .unwrap();
    f.session.private_cache_changed(&f.engine);
    let messages: Vec<Value> = replacement
        .into_iter()
        .flat_map(|out| f.session.output(out, &f.engine))
        .map(|out| serde_json::to_value(out).unwrap())
        .collect();
    let rows = messages
        .iter()
        .rev()
        .find(|m| m["t"] == "rows" && m["sub"] == "s")
        .unwrap()["rows"]
        .as_array()
        .unwrap();
    let people: BTreeSet<_> = rows
        .iter()
        .filter(|r| r["kind"] == "person")
        .map(|r| r["author"]["pubkey"].as_str().unwrap())
        .collect();
    let expected = [pubkey(2), pubkey(4)];
    assert_eq!(people, expected.iter().map(String::as_str).collect());
    assert!(
        !f.engine
            .private_lists
            .values()
            .flatten()
            .any(|tag| tag.contains(&pubkey(2)))
    );
}
#[test]
fn ranking_uses_own_and_follow_membership_without_changing_note_membership() {
    let follows = event(1, 3, 100, "", vec![vec!["p".into(), pubkey(3)]]);
    let follower = event(2, 3, 100, "", vec![vec!["p".into(), pubkey(1)]]);
    let mut f = Fixture::new(vec![
        follows,
        follower,
        profile(1, 100, "alice blue z", "", ""),
        profile(2, 100, "alice blue a", "", ""),
        profile(3, 100, "alice blue b", "", ""),
        note(8, 1_700_000_000),
    ]);
    f.open(1);
    let people = f.people();
    assert_eq!(
        people
            .iter()
            .map(|p| p["author"]["pubkey"].as_str().unwrap())
            .collect::<Vec<_>>(),
        [pubkey(1), pubkey(3), pubkey(2)]
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>()
    );
    assert_eq!(people[0]["self"], true);
    assert_eq!(people[1]["followed"], true);
    assert_eq!(people[2]["followsYou"], true);
    assert_eq!(f.notes().len(), 1);
}
