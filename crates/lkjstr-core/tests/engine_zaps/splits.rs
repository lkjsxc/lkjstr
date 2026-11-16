#![allow(clippy::unwrap_used)]
use super::common;
use common::*;
use lkjstr_core::{engine::zaps::*, store::Store};

fn plan(tags: Vec<Vec<String>>) -> Result<TargetPlan> {
    let mut store = Store::new(8);
    let note = event(2, 1, tags, "split", 1);
    let value = Target::Event {
        id: note.id.clone(),
    };
    store.insert(note, None);
    target(&store, &value)
}
#[test]
fn equal_weights_and_integer_remainders_preserve_every_millisatoshi() {
    let plan = plan(vec![
        tag(&["zap", &key(2).public_key(), "wss://a.test"]),
        tag(&["zap", &key(3).public_key(), "wss://b.test"]),
    ])
    .unwrap();
    assert_eq!(
        allocations(&plan, 5)
            .unwrap()
            .iter()
            .map(|(_, n)| *n)
            .collect::<Vec<_>>(),
        vec![3, 2]
    );
    let amounts = allocations(&plan, MAX_MSAT).unwrap();
    assert_eq!(amounts.iter().map(|(_, n)| n).sum::<u64>(), MAX_MSAT);
    assert!(allocations(&plan, 1).is_err());
}
#[test]
fn decimal_weights_are_exact_and_missing_weights_become_zero() {
    let plan = plan(vec![
        tag(&["zap", &key(2).public_key(), "wss://a.test", "1.5"]),
        tag(&["zap", &key(3).public_key(), "wss://b.test", "0.5"]),
        tag(&["zap", &key(6).public_key(), "wss://c.test"]),
    ])
    .unwrap();
    assert_eq!(plan.recipients.len(), 2);
    assert_eq!(
        allocations(&plan, 4)
            .unwrap()
            .iter()
            .map(|(_, n)| *n)
            .collect::<Vec<_>>(),
        vec![3, 1]
    );
}
#[test]
fn duplicate_recipients_combine_weight_without_duplicate_invoices() {
    let key2 = key(2).public_key();
    let plan = plan(vec![
        tag(&["zap", &key2, "wss://a.test", "1"]),
        tag(&["zap", &key(3).public_key(), "wss://b.test", "1"]),
        tag(&["zap", &key2, "wss://c.test", "2"]),
    ])
    .unwrap();
    assert_eq!(plan.recipients.len(), 2);
    assert_eq!(plan.recipients[0].metadata_relays.len(), 2);
    assert_eq!(allocations(&plan, 4).unwrap()[0], (key2, 3));
}
#[test]
fn malformed_signed_splits_never_fall_back_to_the_author() {
    for weight in ["NaN", "-1", "1e9", ".5", "1.0000000001", "", "0"] {
        assert!(
            plan(vec![tag(&[
                "zap",
                &key(3).public_key(),
                "wss://b.test",
                weight
            ])])
            .is_err()
        );
    }
    assert!(plan(vec![tag(&["zap", "not-a-key", "wss://b.test"])]).is_err());
}
#[test]
fn target_must_be_known_and_private_envelopes_are_not_zappable() {
    let mut store = Store::new(8);
    assert_eq!(
        target(
            &store,
            &Target::Event {
                id: "11".repeat(32)
            }
        ),
        Err(Failure::NotFound)
    );
    let envelope = event(2, 1059, vec![], "ciphertext", 1);
    let value = Target::Event {
        id: envelope.id.clone(),
    };
    store.insert(envelope, None);
    assert_eq!(target(&store, &value), Err(Failure::Unsupported));
}
#[test]
fn every_split_provider_passes_before_an_invoice_plan_is_returned() {
    let (mut store, providers, _) = setup();
    let note = event(
        2,
        1,
        vec![
            tag(&["zap", &key(2).public_key(), "wss://a.test", "1"]),
            tag(&["zap", &key(3).public_key(), "wss://b.test", "1"]),
        ],
        "split",
        1,
    );
    let value = Target::Event {
        id: note.id.clone(),
    };
    store.insert(note, None);
    let quoted = quote(&store, &providers, &value, Some(21_000), 100).unwrap();
    assert_eq!(quoted.phase, Phase::Loading);
    assert_eq!(quoted.recipients[0].amount_msat, Some(10_500));
    assert!(
        invoice_plan(
            &store,
            &providers,
            &InvoiceInput {
                target: value,
                amount_msat: 21_000,
                comment: String::new(),
            },
            &key(1).public_key(),
            &["wss://relay.test".into()],
            100
        )
        .is_err()
    );
}
