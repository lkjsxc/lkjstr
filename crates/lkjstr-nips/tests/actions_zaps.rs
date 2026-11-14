#![allow(clippy::unwrap_used)]
mod common;
use common::{event, key, tag, unsigned};
use lkjstr_nips::{
    actions::{self, ReactionValue},
    event::{Event, UnsignedEvent},
    invoice::Invoice,
    zap::{self, ZapRequest},
};

#[test]
fn reaction_values_and_last_target_precedence() {
    let target = "11".repeat(32);
    let author = key(2).public_key();
    for (content, expected) in [
        ("", ReactionValue::Like),
        ("+", ReactionValue::Like),
        ("-", ReactionValue::Dislike),
        ("🔥", ReactionValue::Text("🔥".into())),
    ] {
        let e = unsigned(
            7,
            vec![
                tag(&["e", &"22".repeat(32)]),
                tag(&["e", &target]),
                tag(&["p", &author]),
            ],
            content,
        );
        let reaction = actions::reaction(&e).unwrap();
        assert_eq!(reaction.event, target);
        assert_eq!(reaction.author, Some(author.clone()));
        assert_eq!(reaction.value, expected);
    }
    assert!(actions::reaction(&unsigned(7, vec![], "+")).is_err());
    let target = event(30023, vec![tag(&["d", "article"])], "content");
    let e = actions::reaction_event(
        key(2).public_key(),
        &target,
        "🔥",
        "wss://relay.example",
        10,
    )
    .unwrap();
    assert!(actions::reaction(&e).unwrap().address.is_some());
}
#[test]
fn repost_embedded_signature_id_kind_author_and_protection() {
    let target = event(1, vec![], "target");
    let signer = key(2);
    let repost =
        actions::repost_event(signer.public_key(), &target, "wss://relay.example", 11).unwrap();
    let signed = repost.clone().sign(&signer, &[4; 32]).unwrap();
    assert_eq!(
        actions::repost(&signed).unwrap().embedded,
        Some(target.clone())
    );
    let mut wrong_id = repost.clone();
    wrong_id.tags[0][1] = "00".repeat(32);
    assert!(actions::repost(&wrong_id.sign(&signer, &[4; 32]).unwrap()).is_err());
    let mut wrong_kind = repost.clone();
    wrong_kind.kind = 16;
    assert!(actions::repost(&wrong_kind.sign(&signer, &[4; 32]).unwrap()).is_err());
    let mut tampered = target.clone();
    tampered.data.content.push('!');
    let mut wrong_content = repost;
    wrong_content.content = tampered.to_json().unwrap();
    assert!(actions::repost(&wrong_content.sign(&signer, &[4; 32]).unwrap()).is_err());
    let protected = event(1, vec![tag(&["-"])], "protected");
    let e =
        actions::repost_event(signer.public_key(), &protected, "wss://relay.example", 11).unwrap();
    assert!(e.content.is_empty());
    assert!(
        actions::repost(&e.sign(&signer, &[4; 32]).unwrap())
            .unwrap()
            .embedded
            .is_none()
    );
}
#[test]
fn illustrative_zap_request_invalid_id_is_rejected_and_callback_amount_checked() {
    let e: Event = serde_json::from_str(include_str!("vectors/nip57-0.json")).unwrap();
    assert!(ZapRequest::parse(&e).is_err());
    let signed = e.data.clone();
    let request = ZapRequest::parse(
        &UnsignedEvent {
            pubkey: key(1).public_key(),
            ..signed
        }
        .sign(&key(1), &[0; 32])
        .unwrap(),
    )
    .unwrap();
    assert_eq!(request.amount_msat, Some(21000));
    request
        .validate_callback(21000, &key(4).public_key())
        .unwrap();
    assert!(
        request
            .validate_callback(22000, &key(4).public_key())
            .is_err()
    );
}
fn example_receipt() -> Event {
    common::invoices::receipt()
}
#[test]
fn generated_receipt_request_and_invoice_pass_cryptographic_validation() {
    let receipt = example_receipt();
    let result = zap::validate_receipt(&receipt, &key(4).public_key(), None).unwrap();
    assert_eq!(result.invoice.amount_msat(), Some(21000));
    assert!(result.invoice.description_hash().is_some());
    assert_eq!(result.request.data.kind, 9734);
}
#[test]
fn zap_validation_rejects_provider_targets_amount_hash_and_preimage_mismatches() {
    let receipt = example_receipt();
    assert!(zap::validate_receipt(&receipt, &key(3).public_key(), None).is_err());
    for name in ["p", "e", "P", "preimage", "description", "bolt11"] {
        let mut data = receipt.data.clone();
        let field = data.tags.iter_mut().find(|t| t[0] == name).unwrap();
        field[1] = match name {
            "description" => "{}".into(),
            "bolt11" => "bad".into(),
            _ => "00".repeat(32),
        };
        let changed = data.sign(&key(4), &[5; 32]).unwrap();
        assert!(zap::validate_receipt(&changed, &key(4).public_key(), None).is_err());
    }
    let mut data = receipt.data.clone();
    data.tags.push(tag(&["p", &key(1).public_key()]));
    assert!(
        zap::validate_receipt(
            &data.sign(&key(4), &[5; 32]).unwrap(),
            &key(4).public_key(),
            None
        )
        .is_err()
    );
}
#[test]
fn zap_request_tag_cardinality_and_invalid_amounts() {
    let valid_tags = vec![
        tag(&["p", &key(2).public_key()]),
        tag(&["relays", "wss://r.example"]),
    ];
    assert!(ZapRequest::parse(&event(9734, valid_tags.clone(), "")).is_ok());
    for extra in [
        tag(&["p", &key(3).public_key()]),
        tag(&["a", "bad"]),
        tag(&["amount", "-1"]),
        tag(&["amount", "0"]),
        tag(&["e", "bad"]),
    ] {
        let mut tags = valid_tags.clone();
        tags.push(extra);
        assert!(ZapRequest::parse(&event(9734, tags, "")).is_err());
    }
    assert!(ZapRequest::parse(&event(9734, vec![tag(&["p", &key(2).public_key()])], "")).is_err());
}
#[test]
fn invoice_checks_checksum_signature_size_and_amount_prefix() {
    let receipt = example_receipt();
    let bolt11 = receipt.data.tags.iter().find(|t| t[0] == "bolt11").unwrap()[1].clone();
    assert!(Invoice::parse(&bolt11.to_uppercase()).is_ok());
    let mut changed = bolt11.into_bytes();
    changed[10] = if changed[10] == b'q' { b'p' } else { b'q' };
    assert!(Invoice::parse(std::str::from_utf8(&changed).unwrap()).is_err());
    assert!(Invoice::parse(&"a".repeat(16385)).is_err());
}
