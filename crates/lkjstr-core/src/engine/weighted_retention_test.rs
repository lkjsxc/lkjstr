use super::*;
use crate::{
    engine::protocol::{Input, Query, Source},
    store::Store,
};
use lkjstr_protocol::NostrEvent;

fn event(id: u64, author: u64, kind: u64) -> NostrEvent {
    NostrEvent {
        id: format!("{id:064x}"),
        pubkey: format!("{author:064x}"),
        created_at: 1,
        kind,
        tags: vec![],
        content: if kind == 0 {
            r#"{"name":"visible"}"#.into()
        } else {
            String::new()
        },
        sig: "0".repeat(128),
    }
}

fn pressure(source: Source) {
    let mut engine = Engine::new();
    engine.store = Store::with_caps(8, 3).weight_retention();
    let profile = event(1, 7, 0);
    let note = event(20, 7, 1);
    let mut follows = event(30, 8, 3);
    follows.tags = vec![vec!["p".into(), note.pubkey.clone()]];
    for event in [&profile, &note, &follows] {
        engine.store.insert_deferred(event.clone(), None);
    }
    engine.input(
        Input::Open {
            sub: "visible".into(),
            query: Query {
                source,
                account: Some(if source == Source::Home {
                    follows.pubkey.clone()
                } else {
                    format!("{:064x}", 9)
                }),
                target: (source == Source::TheirHome).then(|| follows.pubkey.clone()),
                ..Default::default()
            },
        },
        1_800_000_000_000,
    );
    engine.store.insert_deferred(event(10, 11, 0), None);
    engine.store.insert_deferred(event(11, 12, 0), None);
    engine.trim_store();
    assert!(
        engine.store.get(&profile.id).is_some(),
        "a painted name is recently accessed"
    );
    assert!(
        engine.store.get(&follows.id).is_some(),
        "the visible Home keeps its author source"
    );
    assert!(engine.store.get(&note.id).is_some());
    assert_eq!(
        engine.store.len(),
        3,
        "unrelated metadata pays for the pressure"
    );
    if source == Source::TheirHome {
        let input = engine.retention_inputs();
        assert!(
            !input.own.contains(&follows.pubkey),
            "public targets are not owned accounts"
        );
    }
}

#[test]
fn both_home_sources_keep_painted_names_and_follow_dependencies_under_pressure() {
    pressure(Source::Home);
    pressure(Source::TheirHome);
}

#[test]
fn their_home_affinity_never_pins_the_targets_other_account_lists() {
    let mut engine = Engine::new();
    engine.store = Store::with_caps(8, 2).weight_retention();
    let mut follows = event(10, 8, 3);
    follows.tags = vec![vec!["p".into(), format!("{:064x}", 7)]];
    let policy = event(1, 8, 10000);
    engine.store.insert_deferred(follows.clone(), None);
    engine.store.insert_deferred(policy.clone(), None);
    engine.input(
        Input::Open {
            sub: "their".into(),
            query: Query {
                source: Source::TheirHome,
                target: Some(follows.pubkey.clone()),
                ..Default::default()
            },
        },
        1_800_000_000_000,
    );
    let input = engine.retention_inputs();
    assert_eq!(input.affinity.get(&format!("{:064x}", 7)), Some(&32));
    assert!(!input.own.contains(&follows.pubkey));
    engine.store.insert_deferred(event(20, 11, 0), None);
    engine.trim_store();
    assert!(engine.store.get(&follows.id).is_some());
    assert!(
        engine.store.get(&policy.id).is_none(),
        "target mutes acquire no account pin"
    );
}

#[test]
fn ordinary_home_and_their_home_share_owner_and_followed_authors() {
    let mut store = Store::new(8);
    let owner = event(1, 2, 1);
    let followed = event(2, 3, 1);
    let mut list = event(3, 2, 3);
    list.tags = vec![
        vec!["p".into(), owner.pubkey.clone()],
        vec!["p".into(), followed.pubkey.clone()],
    ];
    for event in [&owner, &followed, &list] {
        store.insert(event.clone(), None);
    }
    let home = Query {
        source: Source::Home,
        account: Some(owner.pubkey.clone()),
        ..Default::default()
    };
    let their = Query {
        source: Source::TheirHome,
        target: Some(owner.pubkey.clone()),
        ..Default::default()
    };
    assert_eq!(
        crate::engine::query::filter(&store, &home).authors,
        crate::engine::query::filter(&store, &their).authors
    );
    let ids = |query: &Query| {
        crate::engine::query::events(&store, query)
            .into_iter()
            .map(|event| event.id.clone())
            .collect::<Vec<_>>()
    };
    assert_eq!(ids(&home), ids(&their));
    assert_eq!(ids(&their).len(), 2);
}
