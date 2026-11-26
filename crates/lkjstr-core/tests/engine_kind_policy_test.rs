//! Public focus grows without adding feed members or count contributors.
#![allow(clippy::expect_used)]
#[path = "cache_context/support.rs"]
mod support;
use lkjstr_core::{
    cache::{Record, context::Context, validate_public_reference},
    engine::{
        protocol::{Query, Source},
        query, rows,
    },
    store::Store,
};
use lkjstr_protocol::generate_secret_key;
use support::{capture, event, merge, related, restore};

#[test]
fn generic_context_restores_its_focus_and_only_existing_contributors() {
    let key = generate_secret_key();
    let focus = event(&key, 30311, 10, "generic focus", vec![]);
    let reply = related(&key, &focus, 1, 11);
    let reaction = related(&key, &focus, 7, 12);
    let reference = related(&key, &focus, 30312, 13);
    let mut store = Store::new(100);
    for event in [&focus, &reply, &reaction, &reference] {
        store.insert(event.clone(), None);
    }
    let context = capture(&store, &focus.id, 100);
    let checked = context.checked().expect("valid generic target");
    assert_eq!(checked.len(), 3);
    assert!(checked.contains_key(&focus.id));
    assert!(!checked.contains_key(&reference.id));
    let raw = merge(None, &[context], &[]).expect("context commit");
    let engine = restore(&raw);
    assert_eq!(
        engine.store.get(&focus.id).expect("restored focus").content,
        focus.content
    );
    assert_eq!(engine.store.counts(&focus.id), (1, 0, 1));
    assert!(engine.store.get(&reference.id).is_none());
    let record = Record::verified(&focus).expect("receipt");
    assert!(validate_public_reference(&record).is_some());
    let mut corrupt = record;
    corrupt.raw = corrupt.raw.replace("generic focus", "changed body");
    assert!(validate_public_reference(&corrupt).is_none());
}

#[test]
fn private_and_ephemeral_bodies_stay_stored_but_never_become_public_cache_context() {
    let key = generate_secret_key();
    let mut store = Store::new(100);
    for kind in [4, 13, 14, 1059, 20000, 24133, 29999] {
        let private = event(&key, kind, 10, "synthetic private", vec![]);
        store.insert(private.clone(), None);
        assert!(store.get(&private.id).is_some());
        assert!(
            Context::capture(&store, &private.id, 100)
                .expect("capture")
                .is_none()
        );
        assert!(validate_public_reference(&Record::verified(&private).expect("record")).is_none());
        assert!(store.thread(&private.id).is_empty());
        let wrapper = event(
            &key,
            16,
            11,
            &serde_json::to_string(&private).expect("body"),
            vec![],
        );
        assert!(validate_public_reference(&Record::verified(&wrapper).expect("record")).is_none());
        let row = rows::row(&store, &wrapper, None, 0);
        assert!(
            row.content.is_empty(),
            "a generic repost never draws its raw nested JSON"
        );
    }
}

#[test]
fn generic_references_do_not_become_reply_edges_or_act_terminals() {
    let key = generate_secret_key();
    let parent = event(&key, 1, 1, "not an ancestor", vec![]);
    let focus = related(&key, &parent, 30311, 2);
    let reply = related(&key, &focus, 1, 3);
    let child = related(&key, &reply, 1, 4);
    let generic_child = related(&key, &focus, 30312, 5);
    let reaction = related(&key, &focus, 7, 6);
    let repost = related(&key, &focus, 16, 7);
    let on_reaction = related(&key, &reaction, 7, 8);
    let mut store = Store::new(100);
    for event in [
        &parent,
        &focus,
        &reply,
        &child,
        &generic_child,
        &reaction,
        &repost,
        &on_reaction,
    ] {
        store.insert(event.clone(), None);
    }
    let ids: Vec<_> = store
        .thread(&focus.id)
        .into_iter()
        .map(|e| e.id.clone())
        .collect();
    assert_eq!(ids, [focus.id.clone(), reply.id.clone(), child.id.clone()]);
    assert_eq!(store.counts(&focus.id), (1, 1, 1));
    assert_eq!(store.counts(&reaction.id), (0, 0, 1));
    let row = rows::row(&store, &focus, None, 0);
    assert!(row.reply.is_none());
    assert_eq!(row.counts.replies, 2);
    let q = Query {
        source: Source::Profile,
        target: Some(focus.pubkey.clone()),
        filters: lkjstr_core::engine::protocol::Filters {
            show: Some("reactions".into()),
            ..Default::default()
        },
        ..Default::default()
    };
    assert!(
        query::events(&store, &q).is_empty(),
        "generic targets do not widen legacy activity grouping"
    );
}

#[test]
fn feed_filters_and_selected_kinds_match_their_sources() {
    let key = generate_secret_key();
    let mut store = Store::new(100);
    let mut account = String::new();
    for (index, kind) in [1, 42, 6, 16, 7, 9735, 30023, 30311, 30000, 4]
        .into_iter()
        .enumerate()
    {
        let event = event(&key, kind, 10 + index as u64, "readable event", vec![]);
        account = event.pubkey.clone();
        store.insert(event, None);
    }
    for (source, expected) in [
        (Source::Global, vec![1, 6]),
        (Source::Home, vec![1, 6]),
        (Source::Search, vec![1, 6]),
        (Source::Profile, vec![1, 6, 16]),
        (Source::Thread, vec![1, 42]),
        (Source::Notifications, vec![1, 42, 6, 16, 7, 9735]),
        (Source::Following, vec![0, 3]),
        (Source::Followers, vec![3]),
        (Source::Channels, vec![40]),
        (Source::Channel, vec![42]),
        (Source::People, vec![0]),
        (Source::Bookmarks, vec![10003]),
        (Source::Mutes, vec![10000]),
        (Source::MediaServers, vec![10063]),
        (Source::Emoji, vec![10030]),
        (Source::List, vec![30000]),
    ] {
        let q = Query {
            source,
            account: Some(account.clone()),
            target: Some(account.clone()),
            ..Default::default()
        };
        assert_eq!(query::filter(&store, &q).kinds, Some(expected));
    }
    for source in [
        Source::Global,
        Source::Home,
        Source::Search,
        Source::Profile,
    ] {
        let q = Query {
            source,
            account: Some(account.clone()),
            target: (source == Source::Profile).then(|| account.clone()),
            ..Default::default()
        };
        let kinds: Vec<_> = query::events(&store, &q)
            .into_iter()
            .map(|e| e.kind)
            .collect();
        assert_eq!(
            kinds,
            if source == Source::Profile {
                vec![1]
            } else {
                vec![6, 1]
            }
        );
    }
}

#[test]
fn generic_nip40_expiry_preserves_existing_metadata_and_private_storage_policy() {
    let key = generate_secret_key();
    let mut store = Store::new(100);
    store.advance_clock(19);
    let mut expired = Vec::new();
    let mut retained = Vec::new();
    for kind in [
        1, 6, 7, 16, 42, 30023, 30311, 0, 3, 5, 40, 41, 9735, 10000, 10002, 30000, 30030, 4,
    ] {
        let event = event(
            &key,
            kind,
            10,
            "deadline",
            vec![vec!["expiration".into(), "20".into()]],
        );
        let id = event.id.clone();
        store.insert(event, None);
        assert!(store.get(&id).is_some());
        if [1, 6, 7, 16, 42, 30023, 30311].contains(&kind) {
            expired.push(id);
        } else {
            retained.push(id);
        }
    }
    store.advance_clock(20);
    for id in expired {
        assert!(store.get(&id).is_none());
        assert!(store.verified_expired(&id));
    }
    for id in retained {
        assert!(store.get(&id).is_some());
        assert!(!store.verified_expired(&id));
    }
}
