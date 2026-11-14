#![allow(clippy::unwrap_used)]
mod common;
use bech32::{Bech32, Fe32, primitives::decode::CheckedHrpstring};
use common::{
    invoices::{encode_words, invoice_with_signature},
    key,
};
use k256::ecdsa::SigningKey;
use lkjstr_nips::{Error, invoice::Invoice, zap};

#[test]
fn low_and_high_s_invoices_accept_explicit_and_recovered_payees() {
    let signer = SigningKey::from_bytes(key(5).as_bytes().into()).unwrap();
    for explicit in [false, true] {
        let low = Invoice::parse(&invoice_with_signature(
            "desc", "lnbc210n", explicit, 0, false,
        ))
        .unwrap();
        let high = Invoice::parse(&invoice_with_signature(
            "desc", "lnbc210n", explicit, 0, true,
        ))
        .unwrap();
        assert_eq!(low, high);
        assert_eq!(
            high.payee().as_slice(),
            signer.verifying_key().to_encoded_point(true).as_bytes()
        );
    }
}

#[test]
fn zap_receipts_accept_high_s_invoices_with_and_without_explicit_payees() {
    for explicit in [false, true] {
        let mut data = common::invoices::receipt().data;
        let description = data.tags.iter().find(|t| t[0] == "description").unwrap()[1].clone();
        data.tags.iter_mut().find(|t| t[0] == "bolt11").unwrap()[1] =
            invoice_with_signature(&description, "lnbc210n", explicit, 0, true);
        let receipt = data.sign(&key(4), &[9; 32]).unwrap();
        let checked = zap::validate_receipt(&receipt, &key(4).public_key(), None).unwrap();
        assert_eq!(checked.invoice.amount_msat(), Some(21000));
    }
}

#[test]
fn high_s_explicit_payee_still_rejects_signature_tampering() {
    let encoded = invoice_with_signature("desc", "lnbc210n", true, 0, true);
    let checked = CheckedHrpstring::new::<Bech32>(&encoded).unwrap();
    let mut words: Vec<_> = checked
        .data_part_ascii_no_checksum()
        .iter()
        .map(|c| Fe32::from_char(*c as char).unwrap().to_u8())
        .collect();
    let start = words.len() - 104;
    words[start] ^= 1; // Change r, retaining high-S and a valid Bech32 checksum.
    assert_eq!(
        Invoice::parse(&encode_words("lnbc210n", &words)),
        Err(Error::Signature)
    );
}
