#![allow(clippy::expect_used)]
use super::{Pool, accounting::arc_bytes, event::CompactEvent};
use lkjstr_protocol::NostrEvent;
use std::{mem::size_of, sync::Arc};
fn event(tags: Vec<Vec<String>>) -> NostrEvent {
    NostrEvent {
        id: "1".repeat(64),
        pubkey: "2".repeat(64),
        created_at: 10,
        kind: 1,
        content: String::new(),
        tags,
        sig: "0".repeat(128),
    }
}
#[test]
fn absent_tags_and_one_empty_tag_remain_distinct_without_empty_storage() {
    let mut pool = Pool::default();
    let no_tags = event(vec![]);
    let empty_tag = event(vec![vec![]]);
    let absent = pool.pack(no_tags.clone()).expect("fixture");
    let present = pool.pack(empty_tag.clone()).expect("fixture");
    assert_eq!(absent.to_nostr(), no_tags);
    assert_eq!(present.to_nostr(), empty_tag);
    assert!(absent.matches(&no_tags));
    assert!(present.matches(&empty_tag));
    assert!(!absent.matches(&empty_tag));
    assert!(!present.matches(&no_tags));
    assert_eq!(absent.tags.iter().len(), 0);
    assert_eq!(present.tags.iter().len(), 1);
    assert_eq!(absent.owned_bytes(), arc_bytes::<CompactEvent>());
    assert_eq!(
        present.owned_bytes() - absent.owned_bytes(),
        2 * size_of::<usize>()
    );
    assert_eq!(absent.wire_bytes, present.wire_bytes);
}
#[test]
fn borrowed_relay_and_owned_tag_lookup_share_atoms_without_recharging_them() {
    let mut pool = Pool::default();
    let text = "wss://shared-dictionary.invalid/";
    let relay = pool.text(text);
    let mut spare = String::with_capacity(4096);
    spare.push_str(text);
    let original = event(vec![vec!["r".into(), spare], vec!["r".into(), text.into()]]);
    let packed = pool.pack(original.clone()).expect("fixture");
    let tags: Vec<_> = packed.tags.iter().collect();
    assert!(Arc::ptr_eq(&relay, &tags[0][1]));
    assert!(Arc::ptr_eq(&relay, &tags[1][1]));
    assert_eq!(packed.to_nostr(), original);
    let bytes = pool.managed_bytes();
    for _ in 0..128 {
        assert!(Arc::ptr_eq(&relay, &pool.text(text)));
        assert_eq!(pool.managed_bytes(), bytes);
    }
    // A relay text spelling a valid ID must remain text, distinct from that key.
    let spelling = "2".repeat(64);
    let literal = pool.text(&spelling);
    assert_eq!(literal.as_str(), Some(spelling.as_str()));
    assert!(!Arc::ptr_eq(&literal, &packed.author));
    drop(tags);
    drop(packed);
    pool.reap();
    assert_eq!(relay.as_str(), Some(text));
}
