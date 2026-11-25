#![allow(clippy::expect_used)]
use super::{OrderedEvent, Pool, decode_id, encode_id};
use lkjstr_protocol::NostrEvent;
use std::{collections::BTreeSet, sync::Arc};

fn event(id: u64) -> NostrEvent {
    NostrEvent {
        id: format!("{id:064x}"),
        pubkey: "2".repeat(64),
        created_at: 10,
        kind: 1,
        content: "Exact content: \u{65e5}\u{672c}\u{8a9e} \u{1f642}\0".into(),
        tags: vec![
            vec![],
            vec!["p".into(), "2".repeat(64), String::new(), "opaque".into()],
            vec!["x".into(), "3".repeat(64), "3".repeat(64)],
            vec!["x".into(), "A".repeat(64)],
            vec!["x".into(), String::new()],
            vec![
                "unknown".into(),
                "unicode: \u{0394}\u{1f642}".into(),
                "same".into(),
                "same".into(),
            ],
            vec!["long".into(), "preserve-".repeat(256)],
            vec!["r".into(), "wss://relay.invalid/".into()],
        ],
        sig: "f".repeat(128),
    }
}

#[test]
fn binary_payload_roundtrip_preserves_unknown_empty_duplicate_and_unicode_tags() {
    let mut pool = Pool::default();
    let original = event(1);
    let packed = pool.pack(original.clone()).expect("shaped fixture");
    assert_eq!(packed.to_nostr(), original);
    assert_eq!(*packed.materialize(), original);
    assert!(packed.matches(&original));
    assert_eq!(packed.id(), &decode_id(&original.id).expect("fixture id"));
    assert_eq!(packed.pubkey_hex(), original.pubkey);
    let expected = lkjstr_protocol::tags::tag_values(&original, "x");
    assert_eq!(
        packed
            .tag_values("x")
            .map(|v| v.into_owned())
            .collect::<Vec<_>>(),
        expected
    );
    let tags = packed.tags.iter().collect::<Vec<_>>();
    assert!(Arc::ptr_eq(&packed.author, &tags[1][1]));
    assert!(Arc::ptr_eq(&tags[2][1], &tags[2][2]));
    assert!(Arc::ptr_eq(&tags[2][0], &tags[3][0]));
    assert!(Arc::ptr_eq(&tags[7][1], &pool.text("wss://relay.invalid/")));
    assert_eq!(tags[3][1].as_str(), Some("A".repeat(64).as_str()));
    assert_eq!(
        packed.wire_bytes,
        crate::store::event_payload_bytes(&original)
    );
    assert!(packed.managed_bytes() >= packed.owned_bytes());
}

#[test]
fn duplicate_match_requires_every_signed_field_including_signature() {
    let mut pool = Pool::default();
    let original = event(1);
    let packed = pool.pack(original.clone()).expect("shaped fixture");
    for field in 0..7 {
        let mut changed = original.clone();
        match field {
            0 => changed.id = "9".repeat(64),
            1 => changed.pubkey = "8".repeat(64),
            2 => changed.created_at += 1,
            3 => changed.kind += 1,
            4 => changed.content.push('!'),
            5 => changed.tags.push(vec![]),
            _ => changed.sig = "0".repeat(128),
        }
        assert!(!packed.matches(&changed));
    }
}

#[test]
fn pool_reclaims_only_final_references_and_clones_do_not_duplicate_charges() {
    let mut pool = Pool::default();
    let empty = pool.managed_bytes();
    let first = pool.pack(event(1)).expect("shaped fixture");
    let first_charge = pool.managed_bytes();
    let lease = Arc::clone(&first);
    assert_eq!(pool.managed_bytes(), first_charge);
    let second = pool.pack(event(2)).expect("shaped fixture");
    assert!(Arc::ptr_eq(&first.author, &second.author));
    let relay = pool.text("wss://relay.invalid/");
    assert!(Arc::ptr_eq(&relay, &pool.text("wss://relay.invalid/")));
    drop(first);
    drop(second);
    pool.reap();
    assert_eq!(lease.to_nostr(), event(1));
    assert!(pool.managed_bytes() >= lease.owned_bytes() + relay.managed_bytes());
    drop(lease);
    pool.reap();
    assert_eq!(relay.as_str(), Some("wss://relay.invalid/"));
    assert!(pool.managed_bytes() > empty);
    drop(relay);
    pool.reap();
    assert_eq!(pool.managed_bytes(), empty);
}

#[test]
#[expect(
    clippy::mutable_key_type,
    reason = "Only the immutable timestamp/ID key participates in ordering; allocation counters do not"
)]
fn persistence_lease_outlives_its_dictionary_and_index() {
    let lease = {
        let mut pool = Pool::default();
        let event = pool.pack(event(1)).expect("shaped fixture");
        let mut index = BTreeSet::from([OrderedEvent(Arc::clone(&event))]);
        index.clear();
        pool.reap();
        event
    };
    assert_eq!(lease.to_nostr(), event(1));
    assert!(lease.matches(&event(1)));
}

#[test]
#[expect(
    clippy::mutable_key_type,
    reason = "Only the immutable timestamp/ID key participates in ordering; allocation counters do not"
)]
fn ordered_handles_compare_actual_ids_and_support_borrowed_cursor_keys() {
    let mut pool = Pool::default();
    let high = pool.pack(event(99)).expect("shaped fixture");
    let low = pool.pack(event(1)).expect("shaped fixture");
    let mut index = BTreeSet::from([
        OrderedEvent(Arc::clone(&high)),
        OrderedEvent(Arc::clone(&low)),
    ]);
    assert_eq!(index.first().map(|key| key.0.id_hex()), Some(low.id_hex()));
    assert!(index.contains(&low.order));
    assert!(index.remove(&high.order));
    assert_eq!(index.len(), 1);
    assert!(index.insert(OrderedEvent(high)));
    assert!(!index.insert(OrderedEvent(low)));
}

#[test]
fn first_address_identifier_and_expiration_use_existing_protocol_rules() {
    let mut pool = Pool::default();
    for (tags, expected) in [
        (vec![], ""),
        (vec![vec!["d".into()]], ""),
        (vec![vec!["d".into()], vec!["d".into(), "later".into()]], ""),
        (
            vec![
                vec!["d".into(), String::new()],
                vec!["d".into(), "later".into()],
            ],
            "",
        ),
        (
            vec![
                vec!["d".into(), "first".into()],
                vec!["d".into(), "later".into()],
            ],
            "first",
        ),
    ] {
        let mut source = event(1);
        source.kind = 30030;
        source.tags = tags;
        let packed = pool.pack(source).expect("shaped fixture");
        assert_eq!(packed.identifier().as_deref(), Some(expected));
    }
    let mut expires = event(3);
    expires.tags = vec![vec!["expiration".into(), "100".into()]];
    assert_eq!(
        pool.pack(expires).expect("shaped fixture").expires_at,
        Some(100)
    );
}

#[test]
fn malformed_binary_shapes_fail_without_admitting_symbols() {
    let mut pool = Pool::default();
    let empty = pool.managed_bytes();
    for field in 0..4 {
        let mut source = event(1);
        match field {
            0 => source.id = "A".repeat(64),
            1 => source.pubkey = "2".repeat(63),
            2 => source.sig = "f".repeat(127),
            _ => source.sig = "z".repeat(128),
        }
        assert!(pool.pack(source).is_err());
        assert_eq!(pool.managed_bytes(), empty);
    }
    let id = [255; 32];
    assert_eq!(decode_id(&encode_id(&id)), Some(id));
    assert_eq!(decode_id(&"\u{00e9}".repeat(32)), None);
}
