#![allow(clippy::unwrap_used)]
mod common;
use common::{bytes, fixed};
use lkjstr_nips::{
    hex,
    keys::{self, SecretKey},
    nip44::{self, ConversationKey},
};
use serde_json::Value;
use sha2::{Digest, Sha256};

fn vectors() -> Value {
    serde_json::from_str::<Value>(include_str!("vectors/nip44.json")).unwrap()["v2"].clone()
}
fn s<'a>(v: &'a Value, key: &str) -> &'a str {
    v[key].as_str().unwrap()
}

#[test]
fn all_official_bip340_sign_and_verify_vectors() {
    let mut count = 0;
    for row in include_str!("vectors/bip340.csv").lines().skip(1) {
        let fields: Vec<_> = row.split(',').collect();
        let message = bytes(fields[4]);
        let signature = fixed(fields[5]);
        assert_eq!(
            keys::verify(&fixed(fields[2]), &message, &signature).is_ok(),
            fields[6] == "TRUE",
            "BIP-340 vector {}",
            fields[0]
        );
        if !fields[1].is_empty() {
            let key = SecretKey::from_bytes(fixed(fields[1])).unwrap();
            assert!(key.public_bytes() == fixed::<32>(fields[2]));
            assert!(key.sign(&message, &fixed(fields[3])).unwrap() == signature);
        }
        count += 1;
    }
    assert_eq!(count, 19);
}
#[test]
fn nip44_fixture_matches_specification_checksum() {
    assert_eq!(
        hex(&Sha256::digest(include_bytes!("vectors/nip44.json"))),
        "269ed0f69e4c192512cc779e78c555090cebc7c785b609e338a62afc3ce25040"
    );
}
#[test]
fn all_official_conversation_keys() {
    for vector in vectors()["valid"]["get_conversation_key"]
        .as_array()
        .unwrap()
    {
        let key = SecretKey::from_bytes(fixed(s(vector, "sec1"))).unwrap();
        let result = nip44::conversation_key(&key, &fixed(s(vector, "pub2"))).unwrap();
        assert!(result.as_bytes() == &fixed::<32>(s(vector, "conversation_key")));
    }
}
#[test]
fn all_official_message_keys() {
    let v = vectors();
    let vectors = &v["valid"]["get_message_keys"];
    let key = ConversationKey::from_bytes(fixed(s(vectors, "conversation_key")));
    for vector in vectors["keys"].as_array().unwrap() {
        let result = nip44::message_keys(&key, &fixed(s(vector, "nonce"))).unwrap();
        assert!(result.as_bytes()[..32] == bytes(s(vector, "chacha_key")));
        assert!(result.as_bytes()[32..44] == bytes(s(vector, "chacha_nonce")));
        assert!(result.as_bytes()[44..] == bytes(s(vector, "hmac_key")));
    }
}
#[test]
fn all_official_padding_lengths() {
    for pair in vectors()["valid"]["calc_padded_len"].as_array().unwrap() {
        assert_eq!(
            nip44::padded_len(pair[0].as_u64().unwrap()).unwrap(),
            pair[1].as_u64().unwrap()
        );
    }
}
#[test]
fn all_official_encryption_and_decryption_vectors_both_directions() {
    for vector in vectors()["valid"]["encrypt_decrypt"].as_array().unwrap() {
        let sender = SecretKey::from_bytes(fixed(s(vector, "sec1"))).unwrap();
        let receiver = SecretKey::from_bytes(fixed(s(vector, "sec2"))).unwrap();
        let key = nip44::conversation_key(&sender, &receiver.public_bytes()).unwrap();
        let other = nip44::conversation_key(&receiver, &sender.public_bytes()).unwrap();
        assert!(key.as_bytes() == other.as_bytes());
        assert!(key.as_bytes() == &fixed::<32>(s(vector, "conversation_key")));
        let payload =
            nip44::encrypt(s(vector, "plaintext"), &key, &fixed(s(vector, "nonce"))).unwrap();
        assert!(payload == s(vector, "payload"));
        assert!(nip44::decrypt(&payload, &other).unwrap() == s(vector, "plaintext"));
    }
}
#[test]
fn all_official_long_message_vectors() {
    for vector in vectors()["valid"]["encrypt_decrypt_long_msg"]
        .as_array()
        .unwrap()
    {
        let text = s(vector, "pattern").repeat(vector["repeat"].as_u64().unwrap() as usize);
        assert_eq!(
            hex(&Sha256::digest(text.as_bytes())),
            s(vector, "plaintext_sha256")
        );
        let key = ConversationKey::from_bytes(fixed(s(vector, "conversation_key")));
        let payload = nip44::encrypt(&text, &key, &fixed(s(vector, "nonce"))).unwrap();
        assert_eq!(
            hex(&Sha256::digest(payload.as_bytes())),
            s(vector, "payload_sha256")
        );
        assert!(nip44::decrypt(&payload, &key).unwrap() == text);
    }
}
#[test]
fn all_official_invalid_keys_and_ciphertexts() {
    for vector in vectors()["invalid"]["get_conversation_key"]
        .as_array()
        .unwrap()
    {
        let secret = bytes(s(vector, "sec1"));
        let public = bytes(s(vector, "pub2"));
        let result = <[u8; 32]>::try_from(secret)
            .ok()
            .and_then(|b| SecretKey::from_bytes(b).ok())
            .zip(<[u8; 32]>::try_from(public).ok())
            .and_then(|(s, p)| nip44::conversation_key(&s, &p).ok());
        assert!(result.is_none());
    }
    for vector in vectors()["invalid"]["decrypt"].as_array().unwrap() {
        let key = ConversationKey::from_bytes(fixed(s(vector, "conversation_key")));
        assert!(nip44::decrypt(s(vector, "payload"), &key).is_err());
    }
}
