#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{Engine, wire::Session};
use serde_json::{Value, json};
fn setup(n: usize) -> (Engine, Session, String, Vec<String>) {
    let mut e = Engine::new();
    let keys: Vec<_> = (1..=n).map(|i| format!("{i:064x}")).collect();
    let list = event(
        1,
        3,
        "",
        keys.iter().map(|p| vec!["p".into(), p.clone()]).collect(),
    );
    let owner = list.pubkey.clone();
    e.store.insert(list, None);
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"following","pubkey":owner}}),
        0,
    );
    output(&mut s, &mut e);
    (e, s, owner, keys)
}
fn page(s: &mut Session, e: &mut Engine, anchor: Value, before: usize, after: usize) -> Value {
    accept(
        s,
        e,
        json!({"t":"window","sub":"feed","anchor":anchor,"before":before,"after":after}),
        0,
    );
    output(s, e)
        .into_iter()
        .find(|o| o["t"] == "rows")
        .expect("rows")
}
#[test]
fn following_windows_reach_every_member_without_metadata() {
    for n in [150, 1012] {
        let (mut e, mut s, _, keys) = setup(n);
        let first = page(&mut s, &mut e, json!("top"), 0, 60);
        assert_eq!(first["rows"].as_array().expect("rows").len(), 60);
        assert_eq!(first["atBottom"], false);
        let mut seen = std::collections::BTreeSet::new();
        let mut anchor = json!("top");
        loop {
            let out = page(&mut s, &mut e, anchor, 0, 60);
            let rows = out["rows"].as_array().expect("rows");
            for row in rows {
                seen.insert(row["key"].as_str().expect("key").to_owned());
            }
            if out["atBottom"] == true {
                break;
            }
            anchor = json!({"key":rows.last().expect("last")["key"]});
            assert!(seen.len() < n);
        }
        assert_eq!(seen, keys.into_iter().collect());
    }
}
#[test]
fn following_hydrates_the_member_window_in_batches() {
    let (mut e, mut s, _, keys) = setup(1012);
    e.input(
        lkjstr_core::engine::protocol::Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"feed","anchor":{"key":keys[500]},"before":500,"after":60,"retainAbove":true}),
        0,
    );
    output(&mut s, &mut e);
    e.network.connected(RELAY, 0);
    e.tick(100);
    let requests = frames(&mut e);
    let authors: std::collections::BTreeSet<_> = requests
        .iter()
        .filter(|f| f[0] == "REQ")
        .flat_map(|f| f.as_array().expect("frame").iter().skip(2))
        .filter(|f| f["kinds"] == json!([0]))
        .flat_map(|f| {
            f["authors"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|p| p.as_str().map(str::to_owned))
        })
        .collect();
    assert!(
        keys[500..560].iter().all(|p| authors.contains(p)),
        "requests {requests:?}"
    );
    assert!(!authors.contains(&keys[900]));
    assert!(!authors.contains(&keys[0]));
    assert!(authors.len() <= 120);
    assert!(requests.len() < 10);
}
#[test]
fn newest_membership_and_count_change_together_and_profiles_keep_order() {
    let (mut e, mut s, owner, keys) = setup(150);
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"profile","query":{"source":"profile","pubkey":owner}}),
        0,
    );
    let out = output(&mut s, &mut e);
    assert_eq!(
        out.iter()
            .find(|o| o["sub"] == "profile" && o["t"] == "rows")
            .expect("profile")["rows"][0]["following"],
        150
    );
    let first = page(&mut s, &mut e, json!("top"), 0, 60);
    let mut meta = event(2, 0, r#"{"name":"arrived"}"#, vec![]);
    meta.pubkey = keys[20].clone();
    e.store.insert(meta, None);
    let second = page(&mut s, &mut e, json!("top"), 0, 60);
    assert_eq!(
        first["rows"]
            .as_array()
            .expect("rows")
            .iter()
            .map(|r| &r["key"])
            .collect::<Vec<_>>(),
        second["rows"]
            .as_array()
            .expect("rows")
            .iter()
            .map(|r| &r["key"])
            .collect::<Vec<_>>()
    );
    assert_eq!(second["rows"][20]["author"]["name"], "arrived");
    let mut newer = event(
        3,
        3,
        "",
        vec![
            vec!["p".into(), keys[0].clone()],
            vec!["p".into(), keys[0].clone()],
            vec!["p".into(), "bad".into()],
            vec!["p".into(), keys[1].clone()],
        ],
    );
    newer.pubkey = owner.clone();
    e.store.insert(newer, None);
    let list = page(&mut s, &mut e, json!("top"), 0, 60);
    assert_eq!(list["rows"].as_array().expect("rows").len(), 2);
    assert_eq!(list["atBottom"], true);
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"profile","anchor":"top","before":0,"after":60}),
        1,
    );
    let out = output(&mut s, &mut e);
    assert_eq!(
        out.iter()
            .find(|o| o["sub"] == "profile" && o["t"] == "rows")
            .expect("profile")["rows"][0]["following"],
        2
    );
}
#[test]
fn mute_and_people_set_windows_use_rows_instead_of_list_events() {
    for source in ["mutes", "list"] {
        let mut e = Engine::new();
        let tags = (1..=150)
            .map(|i| vec!["p".into(), format!("{i:064x}")])
            .collect();
        let list = event(1, if source == "mutes" { 10000 } else { 30000 }, "", tags);
        let owner = list.pubkey.clone();
        e.store.insert(list, None);
        let mut s = Session::default();
        accept(
            &mut s,
            &mut e,
            json!({"t":"open","sub":"feed","query":{"source":source,"account":owner}}),
            0,
        );
        output(&mut s, &mut e);
        let out = page(&mut s, &mut e, json!("top"), 0, 60);
        assert_eq!(out["rows"].as_array().expect("rows").len(), 60);
        assert_eq!(out["atBottom"], false, "{source}");
        let key = out["rows"][59]["key"].clone();
        let out = page(&mut s, &mut e, json!({"key":key}), 0, 200);
        assert_eq!(out["rows"].as_array().expect("rows").len(), 91);
        assert_eq!(out["atBottom"], true);
    }
}
#[test]
fn people_sets_skip_invalid_tags_and_deduplicate_valid_members() {
    let mut e = Engine::new();
    let key = "a".repeat(64);
    let list = event(
        1,
        30000,
        "",
        vec![
            vec!["p".into(), key.clone()],
            vec!["p".into(), key.clone()],
            vec!["p".into(), "bad".into()],
        ],
    );
    let owner = list.pubkey.clone();
    e.store.insert(list, None);
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"list","account":owner}}),
        0,
    );
    output(&mut s, &mut e);
    let out = page(&mut s, &mut e, json!("top"), 0, 60);
    assert_eq!(out["rows"].as_array().expect("rows").len(), 1);
    assert_eq!(out["rows"][0]["key"], key);
}
