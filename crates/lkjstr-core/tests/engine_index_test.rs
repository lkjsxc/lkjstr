#![allow(clippy::expect_used, clippy::panic)]
use lkjstr_core::store::{Query, Store};
use lkjstr_protocol::NostrEvent;
#[test]
fn merged_author_indexes_equal_global_filter_with_ties_and_eviction() {
    let mut s = Store::with_caps(80, 20);
    for i in 0..150 {
        s.insert(
            NostrEvent {
                id: format!("{i:064x}"),
                pubkey: format!("{:064x}", i % 7),
                created_at: i / 3,
                kind: 1,
                tags: vec![],
                content: "index fixture".into(),
                sig: String::new(),
            },
            None,
        );
    }
    let authors = [format!("{:064x}", 1), format!("{:064x}", 4)]
        .into_iter()
        .collect();
    let q = Query {
        authors: Some(authors),
        kinds: vec![1],
        until: Some(45),
        limit: 17,
        ..Default::default()
    };
    let selected: Vec<_> = s.feed(&q).into_iter().map(|e| e.id.clone()).collect();
    let expected: Vec<_> = s
        .newest(100)
        .into_iter()
        .filter(|e| e.created_at <= 45 && q.authors.as_ref().is_some_and(|a| a.contains(&e.pubkey)))
        .take(17)
        .map(|e| e.id.clone())
        .collect();
    assert_eq!(selected, expected);
    let empty = Query {
        authors: Some(Default::default()),
        limit: 100,
        ..Default::default()
    };
    assert!(s.feed(&empty).is_empty());
}
