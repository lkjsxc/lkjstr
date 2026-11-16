#![allow(clippy::unwrap_used)]
use super::common;
use common::*;
use lkjstr_core::engine::zaps::*;
use std::sync::Arc;

#[test]
fn authenticated_receipt_uses_signed_sender_and_invoice_amount() {
    let (mut store, providers, value) = setup();
    let prepared = prepared(&store, &providers, &value, 100);
    let mut raw = common::receipt(&prepared, 110);
    raw.tags.push(tag(&["amount", "9000000000000000"]));
    raw = event(4, 9735, raw.tags, "", 110);
    store.insert(raw.clone(), None);
    let proof = providers.get(&store, &key(2).public_key(), 110).unwrap();
    let result = lkjstr_core::engine::zaps::receipt(&store, &raw, proof, 110).unwrap();
    assert_eq!(result.sender, key(1).public_key());
    assert_eq!(result.amount_msat, 21_000);
    assert_eq!(result.comment(&store).as_deref(), Some("signed comment"));
}
#[test]
fn forged_provider_and_changed_description_cannot_attribute_a_sender() {
    let (store, providers, value) = setup();
    let prepared = prepared(&store, &providers, &value, 100);
    let raw = common::receipt(&prepared, 110);
    let proof = providers.get(&store, &key(2).public_key(), 110).unwrap();
    let forged = event(5, 9735, raw.tags.clone(), "", 110);
    assert_eq!(
        lkjstr_core::engine::zaps::receipt(&store, &forged, proof.clone(), 110),
        Err(Failure::Untrusted)
    );
    let mut tags = raw.tags;
    tags.iter_mut().find(|t| t[0] == "description").unwrap()[1].push(' ');
    let tampered = event(4, 9735, tags, "", 110);
    assert_eq!(
        lkjstr_core::engine::zaps::receipt(&store, &tampered, proof, 110),
        Err(Failure::Rejected)
    );
}
#[test]
fn recipient_must_be_authorized_by_the_original_signed_target_split() {
    let (mut store, providers, value) = setup();
    let mut prepared = prepared(&store, &providers, &value, 100);
    // The attacker controls a signed request and its own invoice, but the note
    // author never selected the attacker's key as a split recipient.
    profile(&mut store, 3, "mallory@ln.test", 1);
    let bound = binding(&store, &key(3).public_key()).unwrap();
    let proof = Arc::new(provider(bound.clone(), &response(&bound, 4), 100).unwrap());
    prepared.provider = (*proof).clone();
    for tag in &mut prepared.event.tags {
        if tag[0] == "p" {
            tag[1] = key(3).public_key();
        }
        if tag[0] == "lnurl" {
            tag[1] = bound.lnurl.clone();
        }
    }
    let raw = common::receipt(&prepared, 110);
    assert_eq!(
        lkjstr_core::engine::zaps::receipt(&store, &raw, proof, 110),
        Err(Failure::Rejected)
    );
}
#[test]
fn old_receipts_keep_invoice_expiry_but_require_fresh_provider_and_profile() {
    let (mut store, providers, value) = setup();
    let prepared = prepared(&store, &providers, &value, 100);
    let raw = common::receipt(&prepared, 110);
    let old = providers.get(&store, &key(2).public_key(), 110).unwrap();
    assert_eq!(
        lkjstr_core::engine::zaps::receipt(&store, &raw, old, 700),
        Err(Failure::Expired)
    );
    let bound = binding(&store, &key(2).public_key()).unwrap();
    let fresh = Arc::new(provider(bound.clone(), &response(&bound, 4), 10_000).unwrap());
    assert!(lkjstr_core::engine::zaps::receipt(&store, &raw, fresh.clone(), 10_000).is_ok());
    profile(&mut store, 2, "alice@elsewhere.test", 2);
    assert_eq!(
        lkjstr_core::engine::zaps::receipt(&store, &raw, fresh, 10_000),
        Err(Failure::Stale)
    );
}
#[test]
fn missing_targets_are_pending_and_address_only_receipts_are_unsupported() {
    let (store, providers, value) = setup();
    let mut prepared = prepared(&store, &providers, &value, 100);
    prepared
        .event
        .tags
        .iter_mut()
        .find(|t| t[0] == "e")
        .unwrap()[1] = "11".repeat(32);
    let raw = common::receipt(&prepared, 110);
    let proof = providers.get(&store, &key(2).public_key(), 110).unwrap();
    assert_eq!(
        lkjstr_core::engine::zaps::receipt(&store, &raw, proof.clone(), 110),
        Err(Failure::NotFound)
    );
    prepared.event.tags.retain(|t| t[0] != "e");
    prepared.event.tags.push(tag(&[
        "a",
        &format!("30023:{}:article", key(2).public_key()),
    ]));
    let raw = common::receipt(&prepared, 110);
    assert_eq!(
        lkjstr_core::engine::zaps::receipt(&store, &raw, proof, 110),
        Err(Failure::Unsupported)
    );
}
