#![allow(dead_code, clippy::unwrap_used)]
use super::{key, tag};
use bech32::{Bech32, Fe32, Fe32IterExt, Hrp};
use k256::ecdsa::{Signature, SigningKey};
use lkjstr_nips::event::{Event, UnsignedEvent};
use sha2::{Digest, Sha256};

fn words(bytes: &[u8]) -> Vec<u8> {
    let mut bits = String::new();
    for byte in bytes {
        bits.push_str(&format!("{byte:08b}"));
    }
    while !bits.len().is_multiple_of(5) {
        bits.push('0');
    }
    bits.as_bytes()
        .chunks(5)
        .map(|chunk| chunk.iter().fold(0, |n, b| n * 2 + (b - b'0')))
        .collect()
}
fn field(out: &mut Vec<u8>, kind: u8, bytes: &[u8]) {
    let w = words(bytes);
    let length = w.len();
    out.extend([kind, (length >> 5) as u8, (length & 31) as u8]);
    out.extend(w);
}
pub fn invoice(description: &str, amount: &str, explicit_payee: bool) -> String {
    invoice_with_routes(description, amount, explicit_payee, 0)
}
pub fn invoice_with_routes(
    description: &str,
    amount: &str,
    explicit_payee: bool,
    routes: usize,
) -> String {
    invoice_with_signature(description, amount, explicit_payee, routes, false)
}
pub fn invoice_with_signature(
    description: &str,
    amount: &str,
    explicit_payee: bool,
    routes: usize,
    high_s: bool,
) -> String {
    invoice_with_time(description, amount, explicit_payee, routes, high_s, 1)
}
pub fn invoice_at(description: &str, amount: &str, timestamp: u64) -> String {
    invoice_with_time(description, amount, false, 0, false, timestamp)
}
fn invoice_with_time(
    description: &str,
    amount: &str,
    explicit_payee: bool,
    routes: usize,
    high_s: bool,
    timestamp: u64,
) -> String {
    assert!(timestamp < (1 << 35));
    let signer = SigningKey::from_bytes(key(5).as_bytes().into()).unwrap();
    let hrp = Hrp::parse(amount).unwrap();
    let mut data: Vec<u8> = (0..7)
        .rev()
        .map(|n| ((timestamp >> (n * 5)) & 31) as u8)
        .collect();
    field(&mut data, 1, &Sha256::digest([7; 32]));
    field(&mut data, 16, &[8; 32]);
    field(&mut data, 23, &Sha256::digest(description.as_bytes()));
    if explicit_payee {
        field(
            &mut data,
            19,
            signer.verifying_key().to_encoded_point(true).as_bytes(),
        );
    }
    // Ten valid 51-byte hop records per route-hint field (BOLT11 tag 'r').
    let mut hop = signer
        .verifying_key()
        .to_encoded_point(true)
        .as_bytes()
        .to_vec();
    hop.extend([0; 18]);
    for _ in 0..routes {
        field(&mut data, 3, &hop.repeat(10));
    }
    let mut binary = String::new();
    for w in &data {
        binary.push_str(&format!("{w:05b}"));
    }
    while !binary.len().is_multiple_of(8) {
        binary.push('0');
    }
    let packed: Vec<u8> = binary
        .as_bytes()
        .chunks(8)
        .map(|chunk| chunk.iter().fold(0, |n, b| n * 2 + (b - b'0')))
        .collect();
    let mut digest = Sha256::new();
    digest.update(hrp.as_str().as_bytes());
    digest.update(packed);
    let (signature, recovery) = signer.sign_prehash_recoverable(&digest.finalize()).unwrap();
    assert!(signature.normalize_s().is_none());
    let (signature, recovery) = if high_s {
        (
            Signature::from_scalars(signature.r().to_bytes(), (-signature.s()).to_bytes()).unwrap(),
            recovery.to_byte() ^ 1,
        )
    } else {
        (signature, recovery.to_byte())
    };
    assert_eq!(signature.normalize_s().is_some(), high_s);
    let mut signature = signature.to_bytes().to_vec();
    signature.push(recovery);
    data.extend(words(&signature));
    encode_words(amount, &data)
}
pub fn encode_words(hrp: &str, words: &[u8]) -> String {
    let hrp = Hrp::parse(hrp).unwrap();
    words
        .iter()
        .map(|w| Fe32::try_from(*w).unwrap())
        .with_checksum::<Bech32>(&hrp)
        .chars()
        .collect()
}
pub fn receipt() -> Event {
    let request = UnsignedEvent::new(
        key(1).public_key(),
        1,
        9734,
        vec![
            tag(&["p", &key(2).public_key()]),
            tag(&["e", &"11".repeat(32)]),
            tag(&["relays", "wss://relay.example"]),
            tag(&["amount", "21000"]),
        ],
        "zap",
    )
    .sign(&key(1), &[1; 32])
    .unwrap();
    let description = request.to_json().unwrap();
    UnsignedEvent::new(
        key(4).public_key(),
        2,
        9735,
        vec![
            tag(&["p", &key(2).public_key()]),
            tag(&["P", &key(1).public_key()]),
            tag(&["e", &"11".repeat(32)]),
            tag(&["bolt11", &invoice(&description, "lnbc210n", false)]),
            tag(&["description", &description]),
            tag(&["preimage", &lkjstr_nips::hex(&[7; 32])]),
        ],
        "",
    )
    .sign(&key(4), &[2; 32])
    .unwrap()
}
