#![allow(clippy::unwrap_used)]
mod common;
use bech32::{Bech32, Fe32, primitives::decode::CheckedHrpstring};
use common::{
    invoices::{encode_words, invoice},
    key, tag,
};
use lkjstr_nips::{
    event::{Event, UnsignedEvent},
    invoice::Invoice,
    zap,
};
use sha2::{Digest, Sha256};

#[test]
fn official_nip57_invoice_is_signed_but_illustrative_description_does_not_match() {
    let fixture: serde_json::Value =
        serde_json::from_str(include_str!("vectors/nip57-1.json")).unwrap();
    let tags = fixture["tags"].as_array().unwrap();
    let get = |name: &str| {
        tags.iter().find(|t| t[0] == name).unwrap()[1]
            .as_str()
            .unwrap()
    };
    let invoice = Invoice::parse(get("bolt11")).unwrap();
    assert_eq!(invoice.amount_msat(), Some(1_000_000));
    let description_hash: [u8; 32] = Sha256::digest(get("description").as_bytes()).into();
    assert_ne!(invoice.description_hash(), Some(&description_hash));
    let request: Event = serde_json::from_str(get("description")).unwrap();
    assert!(request.verify().is_err()); // Official illustration has a mismatched ID.
}
#[test]
fn signed_amount_units_and_optional_explicit_node_key() {
    for (hrp, amount) in [
        ("lnbc1", 100_000_000_000),
        ("lnbc1m", 100_000_000),
        ("lntb1u", 100_000),
        ("lnbcrt1n", 100),
        ("lntbs100p", 10),
    ] {
        for explicit in [false, true] {
            assert_eq!(
                Invoice::parse(&invoice("desc", hrp, explicit))
                    .unwrap()
                    .amount_msat(),
                Some(amount)
            );
        }
    }
    assert_eq!(
        Invoice::parse(&invoice("desc", "lnbc", false))
            .unwrap()
            .amount_msat(),
        None
    );
    for invalid in [
        "lnbc0",
        "lnbc01",
        "lnbc1p",
        "lnbc100a",
        "lnxx1",
        "lnbc999999999999999999999999",
    ] {
        assert!(Invoice::parse(&invoice("desc", invalid, false)).is_err());
    }
}
#[test]
fn valid_checksum_but_invalid_signature_or_malformed_tag_is_rejected() {
    let original = invoice("desc", "lnbc210n", true);
    let checked = CheckedHrpstring::new::<Bech32>(&original).unwrap();
    let words: Vec<_> = checked
        .data_part_ascii_no_checksum()
        .iter()
        .map(|c| Fe32::from_char(*c as char).unwrap().to_u8())
        .collect();
    let mut changed = words.clone();
    let end = changed.len() - 104;
    changed[end] ^= 1;
    assert!(Invoice::parse(&encode_words("lnbc210n", &changed)).is_err());
    let mut malformed = words;
    malformed[8] = 31;
    malformed[9] = 31;
    assert!(Invoice::parse(&encode_words("lnbc210n", &malformed)).is_err());
}
#[test]
fn request_amount_and_lnurl_mismatches_survive_valid_resigning() {
    let receipt = common::invoices::receipt();
    let mut request: Event = serde_json::from_str(
        receipt
            .data
            .tags
            .iter()
            .find(|t| t[0] == "description")
            .unwrap()[1]
            .as_str(),
    )
    .unwrap();
    request
        .data
        .tags
        .iter_mut()
        .find(|t| t[0] == "amount")
        .unwrap()[1] = "22000".into();
    request = request.data.sign(&key(1), &[3; 32]).unwrap();
    let description = request.to_json().unwrap();
    let changed = UnsignedEvent::new(
        key(4).public_key(),
        2,
        9735,
        vec![
            tag(&["p", &key(2).public_key()]),
            tag(&["e", &"11".repeat(32)]),
            tag(&["bolt11", &invoice(&description, "lnbc210n", false)]),
            tag(&["description", &description]),
        ],
        "",
    )
    .sign(&key(4), &[5; 32])
    .unwrap();
    assert!(zap::validate_receipt(&changed, &key(4).public_key(), None).is_err());
}
