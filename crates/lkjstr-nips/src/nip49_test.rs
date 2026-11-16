#![allow(clippy::expect_used, clippy::panic)]
use super::*;
const VECTOR: &str = "ncryptsec1qgg9947rlpvqu76pj5ecreduf9jxhselq2nae2kghhvd5g7dgjtcxfqtd67p9m0w57lspw8gsq6yphnm8623nsl8xn9j4jdzz84zm3frztj3z7s35vpzmqf6ksu8r89qk5z2zxfmu5gv8th8wclt0h4p";

fn fixture() -> EncryptedKey {
    encrypt(
        &SecretKey::from_bytes([3; 32]).expect("fixture key"),
        "fixture password",
        8,
        1,
        &[4; 16],
        &[5; 24],
    )
    .expect("encrypt")
}
fn changed(mut bytes: [u8; 91], at: usize, value: u8) -> String {
    bytes[at] = value;
    bech32::encode::<ProtocolBech32<ENCODED_LEN>>(Hrp::parse("ncryptsec").expect("hrp"), &bytes)
        .expect("encode malformed fixture")
}
#[test]
fn official_decryption_vector() {
    let envelope = EncryptedKey::parse(VECTOR).expect("NIP-49 vector");
    assert_eq!(envelope.log_n(), 16);
    let secret = envelope.decrypt("nostr").expect("decrypt official vector");
    assert_eq!(
        crate::hex(secret.as_bytes()),
        "3501454135014541350145413501453fefb02227e449e57cf4d3a3ce05378683"
    );
}
#[test]
fn unicode_passwords_use_nfkc() {
    let key = SecretKey::from_bytes([3; 32]).expect("key");
    let a = encrypt(
        &key,
        "\u{212b}\u{2126}\u{1e9b}\u{0323}",
        8,
        2,
        &[6; 16],
        &[7; 24],
    )
    .expect("unicode encryption");
    let b = encrypt(&key, "\u{00c5}\u{03a9}\u{1e69}", 8, 2, &[6; 16], &[7; 24])
        .expect("normalized encryption");
    assert_eq!(a.encode().expect("encode"), b.encode().expect("encode"));
    assert_eq!(
        a.decrypt("\u{00c5}\u{03a9}\u{1e69}")
            .expect("normalized unlock")
            .public_key(),
        key.public_key()
    );
}
#[test]
fn roundtrip_is_exact_and_debug_redacts() {
    let encoded = fixture().encode().expect("encode");
    assert_eq!(encoded.len(), ENCODED_LEN);
    let parsed = EncryptedKey::parse(&encoded.to_ascii_uppercase()).expect("uppercase bech32");
    assert_eq!(parsed.encode().expect("canonical"), encoded);
    assert_eq!(
        parsed
            .decrypt("fixture password")
            .expect("decrypt")
            .as_bytes(),
        &[3; 32]
    );
    let debug = format!("{parsed:?}");
    assert!(!debug.contains(&encoded));
    assert!(!debug.contains("fixture password"));
    assert!(!debug.contains(&crate::hex(&[3; 32])));
}
#[test]
fn wrong_password_and_tampering_are_authenticated() {
    let envelope = fixture();
    assert!(matches!(
        envelope.decrypt("wrong"),
        Err(Error::Authentication)
    ));
    for at in [2, 18, 42, 43, 90] {
        let encoded = changed(envelope.bytes, at, envelope.bytes[at] ^ 1);
        let parsed = EncryptedKey::parse(&encoded).expect("well formed tampered envelope");
        assert!(matches!(
            parsed.decrypt("fixture password"),
            Err(Error::Authentication)
        ));
    }
}
#[test]
fn hostile_costs_versions_and_security_bytes_fail_before_kdf() {
    let envelope = fixture();
    for cost in [19, 20, 31, 255] {
        assert!(matches!(
            EncryptedKey::parse(&changed(envelope.bytes, 1, cost)),
            Err(Error::Size)
        ));
    }
    assert!(matches!(
        EncryptedKey::parse(&changed(envelope.bytes, 1, 0)),
        Err(Error::Invalid)
    ));
    assert!(matches!(
        EncryptedKey::parse(&changed(envelope.bytes, 0, 1)),
        Err(Error::Version)
    ));
    assert!(matches!(
        EncryptedKey::parse(&changed(envelope.bytes, 42, 3)),
        Err(Error::Invalid)
    ));
    assert_eq!(
        EncryptedKey::parse(&changed(envelope.bytes, 1, 18))
            .expect("budget boundary")
            .log_n(),
        18
    );
}
#[test]
fn malformed_encoding_and_password_limits_are_rejected() {
    let encoded = fixture().encode().expect("encode");
    for invalid in [
        "".to_owned(),
        encoded[..161].to_owned(),
        format!("{encoded}q"),
        encoded.replacen('n', "N", 1),
        encoded.replacen('q', "!", 1),
    ] {
        assert!(EncryptedKey::parse(&invalid).is_err());
    }
    let mut bad_checksum = encoded.into_bytes();
    bad_checksum[161] = if bad_checksum[161] == b'q' {
        b'p'
    } else {
        b'q'
    };
    assert!(EncryptedKey::parse(core::str::from_utf8(&bad_checksum).expect("ascii")).is_err());
    let encoded = bech32::encode::<ProtocolBech32<ENCODED_LEN>>(
        Hrp::parse("different").expect("hrp"),
        &fixture().bytes,
    )
    .expect("different HRP");
    assert!(EncryptedKey::parse(&encoded).is_err());
    assert!(matches!(
        fixture().decrypt(&"x".repeat(MAX_PASSWORD_BYTES + 1)),
        Err(Error::Size)
    ));
    assert!(matches!(
        fixture().decrypt(&"\u{fdfa}".repeat(200)),
        Err(Error::Size)
    ));
}
#[test]
fn authenticated_invalid_curve_scalar_is_rejected() {
    let mut envelope = fixture();
    let key = derive("fixture password", &envelope.bytes[2..18], 8).expect("derive");
    let cipher = XChaCha20Poly1305::new_from_slice(key.as_ref()).expect("cipher");
    envelope.bytes[43..75].fill(0);
    let tag = cipher
        .encrypt_in_place_detached(
            XNonce::from_slice(&[5; 24]),
            &[1],
            &mut envelope.bytes[43..75],
        )
        .expect("encrypt invalid scalar fixture");
    envelope.bytes[75..91].copy_from_slice(&tag);
    assert!(matches!(
        envelope.decrypt("fixture password"),
        Err(Error::Key)
    ));
}
