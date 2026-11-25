#![allow(clippy::expect_used)]
use lkjstr_core::{
    persistence::PendingEvents,
    store::{Inserted, Store},
};
use lkjstr_protocol::NostrEvent;
use std::sync::Arc;

fn event(id: u64, kind: u64) -> NostrEvent {
    NostrEvent {
        id: format!("{id:064x}"),
        pubkey: "a".repeat(64),
        created_at: id,
        kind,
        tags: vec![vec!["p".into(), "b".repeat(64)]],
        content: "leased payload".into(),
        sig: "0".repeat(128),
    }
}

#[test]
fn persistence_shares_the_store_allocation_and_survives_eviction_and_retry() {
    let mut store = Store::new(1);
    let original = event(1, 1);
    store.insert(original.clone(), Some("wss://fixture.invalid/"));
    let lease = store.lease(&original.id).expect("stored lease");
    let mut pending = PendingEvents::default();
    assert!(pending.push_lease(lease.clone()));
    let failed = pending.batch();
    assert!(Arc::ptr_eq(&lease, &failed[0]));
    store.insert(event(2, 1), None);
    assert!(store.get(&original.id).is_none());
    assert_eq!(failed[0].to_nostr(), original);
    assert_eq!(pending.batch()[0].to_nostr(), original);
    pending.committed(&failed);
    assert!(pending.is_empty());
    assert_eq!(failed[0].to_nostr(), original);
}

#[test]
fn staged_publication_reserves_capacity_but_is_not_persisted_before_a_frame() {
    let mut store = Store::new(2);
    let own = event(1, 1);
    let filler = event(2, 1);
    store.insert(own.clone(), None);
    store.insert(filler.clone(), None);
    let mut pending = PendingEvents::default();
    assert!(pending.reserve(store.lease(&own.id).expect("own lease")));
    assert!(pending.is_empty());
    assert!(pending.batch().is_empty());
    let filler = store.lease(&filler.id).expect("filler lease");
    for _ in 0..19_999 {
        assert!(pending.push_lease(filler.clone()));
    }
    assert!(!pending.push_lease(filler));
    assert!(!pending.can_admit(&event(3, 1)));
    assert!(pending.activate(&own.id));
    assert_eq!(pending.len(), 20_000);
    let batch = pending.batch();
    assert!(batch.iter().all(|item| item.id_hex() != own.id));
    pending.committed(&batch);
    assert_eq!(pending.len(), 1);
    let batch = pending.batch();
    assert_eq!(batch[0].to_nostr(), own);
    pending.committed(&batch);
    assert!(pending.is_empty());
}

#[test]
fn cancelled_publication_releases_its_reserved_payload_charge() {
    let mut store = Store::new(1);
    let own = event(1, 1);
    store.insert(own.clone(), None);
    let mut pending = PendingEvents::default();
    assert!(pending.reserve(store.lease(&own.id).expect("own lease")));
    assert!(pending.payload_bytes() > 0);
    pending.cancel_reservation(&own.id);
    assert_eq!(pending.payload_bytes(), 0);
    assert!(!pending.activate(&own.id));
    assert!(pending.batch().is_empty());
}

#[test]
fn malformed_compact_input_cannot_remove_the_previous_metadata_revision() {
    let mut store = Store::new(4);
    let original = event(1, 0);
    assert_eq!(store.insert(original.clone(), None), Inserted::New);
    let mut malformed = event(2, 0);
    malformed.sig.clear();
    assert_eq!(store.insert(malformed, None), Inserted::InvalidEncoding);
    assert_eq!(
        store.replaceable(&original.pubkey, 0).as_deref(),
        Some(&original)
    );
}
