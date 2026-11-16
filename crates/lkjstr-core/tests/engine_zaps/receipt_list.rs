#![allow(clippy::unwrap_used)]
use super::common;
use common::*;
use lkjstr_core::engine::zaps::*;

#[test]
fn anonymous_and_private_receipts_never_identify_the_ephemeral_outer_key_as_payer() {
    for (anon, expected) in [
        (vec!["anon"], Sender::Anonymous),
        (vec!["anon", "pzap1opaque_iv1opaque"], Sender::Private),
    ] {
        let (mut store, providers, target) = setup();
        let mut request = prepared(&store, &providers, &target, 100);
        request.event.tags.push(tag(&anon));
        let raw = common::receipt(&request, 110);
        store.insert(raw.clone(), None);
        let proof = providers.get(&store, &key(2).public_key(), 110).unwrap();
        let trusted = lkjstr_core::engine::zaps::receipt(&store, &raw, proof, 110).unwrap();
        assert_eq!(trusted.payer, expected);
        let json = serde_json::to_value(ReceiptRow::from(&trusted)).unwrap();
        assert!(!json["sender"].to_string().contains(&key(1).public_key()));
        if expected == Sender::Private {
            assert_eq!(trusted.comment(&store), None);
        }
    }
}
#[test]
fn duplicated_anonymous_markers_are_not_attributed() {
    let (store, providers, target) = setup();
    let mut request = prepared(&store, &providers, &target, 100);
    request.event.tags.extend([tag(&["anon"]), tag(&["anon"])]);
    let raw = common::receipt(&request, 110);
    let proof = providers.get(&store, &key(2).public_key(), 110).unwrap();
    assert_eq!(
        lkjstr_core::engine::zaps::receipt(&store, &raw, proof, 110),
        Err(Failure::Rejected)
    );
}
#[test]
fn list_exposes_only_canonical_provider_authorized_receipts_and_separate_unknowns() {
    let (mut store, providers, target) = setup();
    let request = prepared(&store, &providers, &target, 100);
    let first = common::receipt(&request, 110);
    let duplicate = event(4, 9735, first.tags.clone(), "", 111);
    let forged = event(5, 9735, first.tags.clone(), "", 112);
    let ids = vec![first.id.clone(), duplicate.id.clone(), forged.id.clone()];
    for raw in [first.clone(), duplicate, forged] {
        store.insert(raw, None);
    }
    let mut receipts = Receipts::default();
    receipts.sync(&store, &providers, &ids, 120).unwrap();
    let pending = receipts
        .page(&store, &providers, &target, None, 10, 120)
        .unwrap();
    assert!(pending.rows.is_empty());
    assert_eq!(pending.total.unverified, 3);
    receipts.advance(&store, &providers, 120, 4);
    let page = receipts
        .page(&store, &providers, &target, None, 1, 120)
        .unwrap();
    assert_eq!(page.rows.len(), 1);
    assert_eq!(page.rows[0].id, first.id);
    assert_eq!(
        page.rows[0].sender,
        Sender::Public {
            pubkey: key(1).public_key()
        }
    );
    assert_eq!(page.total.receipts, 1);
    assert_eq!(page.total.sats, 21);
    assert!(!page.more);
    assert_eq!(
        receipts.page(&store, &providers, &target, None, 0, 120),
        Err(Failure::Rejected)
    );
    let before = ReceiptCursor {
        at: 110,
        id: first.id,
    };
    assert!(
        receipts
            .page(&store, &providers, &target, Some(&before), 10, 120)
            .unwrap()
            .rows
            .is_empty()
    );
}
