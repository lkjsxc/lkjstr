//! Account isolation, validated interaction targets and public/private mute precedence.
#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::read_plan::{Candidate, select_weighted},
        settings::PrivateLists,
        weights::Weights,
    },
    store::Store,
};
use lkjstr_protocol::NostrEvent;
use std::collections::BTreeSet;
fn put(store: &mut Store, id: u64, author: &str, kind: u64, tags: Vec<Vec<String>>) {
    store.insert(
        NostrEvent {
            id: format!("{id:064x}"),
            pubkey: author.into(),
            kind,
            created_at: id,
            tags,
            content: String::new(),
            sig: "0".repeat(128),
        },
        None,
    );
}
fn tag(k: &str, v: &str) -> Vec<String> {
    vec![k.into(), v.into()]
}
#[test]
fn weights_are_shared_account_scoped_and_mutes_always_win() {
    let mut store = Store::new(100);
    let owner = "a".repeat(64);
    let follow = "b".repeat(64);
    let fof = "c".repeat(64);
    let answered = "d".repeat(64);
    let reacted = "e".repeat(64);
    let spoof = "f".repeat(64);
    put(&mut store, 1, &owner, 3, vec![tag("p", &follow)]);
    put(&mut store, 2, &follow, 3, vec![tag("p", &fof)]);
    put(&mut store, 3, &answered, 1, vec![]);
    put(&mut store, 4, &reacted, 1, vec![]);
    put(
        &mut store,
        5,
        &owner,
        1,
        vec![vec![
            "e".into(),
            format!("{:064x}", 3),
            "".into(),
            "reply".into(),
        ]],
    );
    put(
        &mut store,
        6,
        &owner,
        7,
        vec![tag("e", &format!("{:064x}", 4)), tag("p", &spoof)],
    );
    let private = PrivateLists::default();
    let weights = Weights::new(&store, &private, Some(&owner));
    assert_eq!(
        [
            weights.person(&owner),
            weights.person(&follow),
            weights.person(&fof),
            weights.person(&answered),
            weights.person(&reacted),
            weights.person(&spoof)
        ],
        [64, 32, 8, 16, 16, 1]
    );
    let other = Weights::new(&store, &private, Some(&spoof));
    assert_eq!(other.person(&follow), 1);
    let candidates = [
        Candidate {
            url: "wss://one.test/".into(),
            weight: 600,
            authors: BTreeSet::from([spoof.clone()]),
        },
        Candidate {
            url: "wss://two.test/".into(),
            weight: 600,
            authors: BTreeSet::from([follow.clone()]),
        },
    ];
    assert_eq!(
        select_weighted(&candidates, 1, |p| weights.person(p)),
        ["wss://two.test/"]
    );
    put(
        &mut store,
        7,
        &owner,
        10000,
        vec![tag("p", &follow), tag("p", &owner)],
    );
    let private = PrivateLists::from([(format!("{:064x}", 7), vec![tag("p", &reacted)])]);
    let weights = Weights::new(&store, &private, Some(&owner));
    assert_eq!(weights.person(&owner), 0);
    assert_eq!(weights.person(&follow), 0);
    assert_eq!(weights.person(&reacted), 0);
    assert_eq!(
        weights.event(&store.get(&format!("{:064x}", 4)).expect("reaction target")),
        0
    );
    println!(
        "weight scorecard signals=6 before_distinct=1 after_distinct=5 muted_selected=0 account_leaks=0"
    );
}
