use std::collections::HashSet;

use lkjstr_core::store::{Inserted, Query, Store};
use lkjstr_core::timeline::Timeline;
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};

fn signed(kind: u64, at: u64, content: &str, tags: Vec<Vec<String>>) -> NostrEvent {
    let key = generate_secret_key();
    let template = EventTemplate {
        pubkey: None,
        created_at: at,
        kind,
        tags,
        content: content.to_owned(),
    };
    finalize_event(&template, &key).unwrap_or_else(|_| NostrEvent {
        id: String::new(),
        pubkey: String::new(),
        created_at: 0,
        kind: 0,
        tags: vec![],
        content: String::new(),
        sig: String::new(),
    })
}

fn tag(name: &str, value: &str) -> Vec<String> {
    vec![name.to_owned(), value.to_owned()]
}

#[test]
fn dedupes_and_records_relays() {
    let mut store = Store::new(100);
    let note = signed(1, 10, "hello", vec![]);
    assert_eq!(store.insert(note.clone(), Some("wss://a/")), Inserted::New);
    assert_eq!(
        store.insert(note.clone(), Some("wss://b/")),
        Inserted::Duplicate
    );
    assert_eq!(store.len(), 1);
    assert_eq!(store.seen_on(&note.id), ["wss://a/", "wss://b/"]);
}

#[test]
fn replaceable_keeps_newest_and_profiles_parse() {
    let mut store = Store::new(100);
    let mut old = signed(0, 10, r#"{"name":"old"}"#, vec![]);
    let key = generate_secret_key();
    let make = |at, content: &str| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: at,
                kind: 0,
                tags: vec![],
                content: content.to_owned(),
            },
            &key,
        )
    };
    if let (Ok(a), Ok(b)) = (
        make(10, r#"{"name":"old"}"#),
        make(20, r#"{"display_name":"New","picture":"https://x/p.png"}"#),
    ) {
        old = a;
        assert_eq!(store.insert(b.clone(), None), Inserted::New);
        assert_eq!(store.insert(old.clone(), None), Inserted::Stale);
        let profile = store.profile(&b.pubkey);
        assert_eq!(
            profile.as_ref().and_then(|p| p.label().map(str::to_owned)),
            Some("New".into())
        );
        assert_eq!(
            profile.map(|p| p.picture.clone()),
            Some("https://x/p.png".into())
        );
    }
    assert!(!old.id.is_empty());
}

#[test]
fn feed_thread_counts_and_eviction() {
    let mut store = Store::new(3);
    let root = signed(1, 10, "root", vec![]);
    let reply = signed(1, 20, "reply", vec![tag("e", &root.id)]);
    let like = signed(7, 21, "+", vec![tag("e", &root.id)]);
    for event in [&root, &reply, &like] {
        store.insert(event.clone(), None);
    }
    let thread: Vec<String> = store
        .thread(&root.id)
        .iter()
        .map(|e| e.content.clone())
        .collect();
    assert_eq!(thread, ["root", "reply"]);
    assert_eq!(store.counts(&root.id), (1, 0, 1));
    let feed = store.feed(&Query {
        kinds: vec![1],
        limit: 10,
        ..Query::default()
    });
    assert_eq!(feed.len(), 2);
    assert_eq!(feed[0].content, "reply", "newest first");
    let late = signed(1, 30, "late", vec![]);
    store.insert(late, None);
    assert_eq!(store.len(), 3, "cap evicts the oldest");
    assert!(store.get(&root.id).is_none());
    assert_eq!(
        store.counts(&root.id),
        (1, 0, 1),
        "references survive the target"
    );
}

#[test]
fn authors_mentions_search_and_deletion() {
    let mut store = Store::new(100);
    let a = signed(1, 10, "Rust on nostr", vec![]);
    let b = signed(1, 11, "hi", vec![tag("p", &a.pubkey)]);
    store.insert(a.clone(), None);
    store.insert(b.clone(), None);
    let mine = store.feed(&Query {
        authors: Some(HashSet::from([a.pubkey.clone()])),
        limit: 10,
        ..Query::default()
    });
    assert_eq!(mine.len(), 1);
    let mentions = store.feed(&Query {
        mention: Some(a.pubkey.clone()),
        limit: 10,
        ..Query::default()
    });
    assert_eq!(mentions.len(), 1);
    assert_eq!(store.search_notes("rust", 5).len(), 1);
    let forged = signed(5, 12, "", vec![tag("e", &a.id)]);
    store.insert(forged, None);
    assert!(store.get(&a.id).is_some(), "only the author may delete");
}

#[test]
fn timeline_holds_new_items_behind_marker() {
    let mut timeline = Timeline::new(100);
    let item = |at: u64| (at, format!("{at:064}"));
    timeline.merge(&[item(30), item(20)], true);
    assert_eq!(timeline.shown().len(), 2);
    timeline.merge(&[item(40), item(30), item(10)], false);
    assert_eq!(timeline.pending_count(), 1, "newer than top waits");
    assert_eq!(timeline.shown().len(), 3, "older appends");
    assert_eq!(timeline.shown()[0], item(30), "top does not move");
    timeline.reveal();
    assert_eq!(timeline.shown()[0], item(40));
    timeline.merge(&[item(50)], true);
    assert_eq!(
        timeline.shown()[0],
        item(50),
        "at the top, new items show at once"
    );
    timeline.retain(|id| id != item(50).1);
    assert_eq!(timeline.shown()[0], item(40));
}
