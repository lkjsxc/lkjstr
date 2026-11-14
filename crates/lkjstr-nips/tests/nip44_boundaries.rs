#![allow(clippy::unwrap_used)]
mod common;
use base64::{Engine, engine::general_purpose::STANDARD};
use common::fixed;
use lkjstr_nips::{
    Error, hex,
    nip44::{self, ConversationKey},
};
use sha2::{Digest, Sha256};

#[test]
fn current_official_extended_length_prefix_vectors() {
    let key = ConversationKey::from_bytes(fixed(
        "c41c775356fd92eadc63ff5a0dc1da211b268cbea22316767095b2871ea1412d",
    ));
    let mut nonce = [0; 32];
    nonce[31] = 1;
    for (length, expected) in [
        (
            65535,
            "6d8c2810d1e870fbaa1f0a0937126cca837a15f9260e27060c331d70a3c0bc84",
        ),
        (
            65536,
            "b7b4edb36ba92e267d322d56d9aebc22e7fa96ff52e3c12adc07f07a43cbc616",
        ),
        (
            65537,
            "eeb7c7c5373894ea2c1547cfd3ccb15d5a0b2d619da852e5c79df792dcc9e435",
        ),
    ] {
        let plaintext = "a".repeat(length);
        let payload = nip44::encrypt(&plaintext, &key, &nonce).unwrap();
        assert_eq!(hex(&Sha256::digest(payload.as_bytes())), expected);
        assert!(nip44::decrypt(&payload, &key).unwrap() == plaintext);
    }
}
#[test]
fn memory_limits_and_protocol_limits_are_explicit() {
    let key = ConversationKey::from_bytes([1; 32]);
    assert_eq!(nip44::padded_len(0), Err(Error::Size));
    assert_eq!(nip44::padded_len(u32::MAX as u64).unwrap(), 1u64 << 32);
    assert_eq!(nip44::padded_len(1u64 << 32), Err(Error::Size));
    assert!(nip44::encrypt("", &key, &[0; 32]).is_err());
    assert!(nip44::encrypt(&"a".repeat(nip44::MAX_PLAINTEXT + 1), &key, &[0; 32]).is_err());
    assert_eq!(
        nip44::decrypt(&"a".repeat(nip44::MAX_PAYLOAD + 1), &key),
        Err(Error::Size)
    );
    let largest = "a".repeat(nip44::MAX_PLAINTEXT);
    let encrypted = nip44::encrypt(&largest, &key, &[5; 32]).unwrap();
    assert!(nip44::decrypt(&encrypted, &key).unwrap() == largest);
}
#[test]
fn tampering_every_byte_is_rejected_and_versions_are_distinct() {
    let key = ConversationKey::from_bytes([1; 32]);
    let payload = nip44::encrypt("🔐\nhello", &key, &[2; 32]).unwrap();
    let original = STANDARD.decode(&payload).unwrap();
    for i in 0..original.len() {
        let mut data = original.clone();
        data[i] ^= 1;
        assert!(nip44::decrypt(&STANDARD.encode(data), &key).is_err());
    }
    assert_eq!(nip44::decrypt("#future", &key), Err(Error::Version));
    assert_eq!(nip44::decrypt("", &key), Err(Error::Version));
}
#[test]
fn padding_size_properties_exhaustive_first_million() {
    let mut previous = 0;
    for length in 1..=1_048_576 {
        let size = nip44::padded_len(length).unwrap();
        assert!(size >= length && size >= previous && size <= length.max(32) * 2);
        previous = size;
    }
}
#[test]
fn secrets_have_redacted_debug() {
    let secret = common::key(1);
    let key = nip44::conversation_key(&secret, &common::key(2).public_bytes()).unwrap();
    assert_eq!(format!("{secret:?}"), "SecretKey([REDACTED])");
    assert_eq!(format!("{key:?}"), "ConversationKey([REDACTED])");
    assert_eq!(
        format!("{:?}", nip44::message_keys(&key, &[1; 32]).unwrap()),
        "MessageKeys([REDACTED])"
    );
    assert_eq!(
        format!("{:?}", lkjstr_nips::entity::Entity::Nsec(secret)),
        "Nsec([REDACTED])"
    );
}
