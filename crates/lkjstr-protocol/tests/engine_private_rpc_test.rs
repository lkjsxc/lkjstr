#![allow(clippy::expect_used)]
//! A signed bunker error remains distinct only for the private crypto caller.
use lkjstr_nips::{keys::SecretKey, nip44};
use lkjstr_protocol as p;
use serde_json::json;
#[test]
fn private_rpc_preserves_exact_unsupported_without_inventing_timeouts() {
    let key = SecretKey::from_bytes([7; 32]).expect("fixture");
    let (remote, _) = p::remote::Remote::parse(&format!(
        "bunker://{}?relay=ws://127.0.0.1:1",
        key.public_key()
    ))
    .expect("fixture");
    let client = remote.client().expect("fixture");
    let conversation =
        nip44::conversation_key(&key, &lkjstr_nips::unhex::<32>(&client).expect("fixture"))
            .expect("fixture");
    for (error, expected) in [
        ("unsupported", "unsupported"),
        ("not authorized", "signer-refused"),
        ("signer-timeout", "signer-refused"),
    ] {
        let content = nip44::encrypt(
            &json!({"id":"fixture","error":error}).to_string(),
            &conversation,
            &[9; 32],
        )
        .expect("fixture");
        let event = p::sign_event_with_secret_hex(
            &p::UnsignedNostrEvent {
                pubkey: key.public_key(),
                created_at: 1700000000,
                kind: 24133,
                tags: vec![vec!["p".into(), client.clone()]],
                content,
            },
            &lkjstr_nips::hex(&[7; 32]),
        )
        .expect("fixture");
        assert_eq!(
            remote.response(&event, "fixture"),
            Some(Err("signer-refused"))
        );
        assert_eq!(
            remote.response_private(&event, "fixture"),
            Some(Err(expected))
        );
        assert_eq!(remote.response_private(&event, "different"), None);
    }
}
