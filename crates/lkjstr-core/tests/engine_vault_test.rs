#![allow(clippy::expect_used, clippy::panic)]
use lkjstr_core::engine::{
    accounts::Accounts,
    wire::{Input, Output},
};
use lkjstr_nips::{keys::SecretKey, nip49};
use lkjstr_protocol as p;
use serde_json::json;
fn envelope() -> (String, String) {
    let key = SecretKey::from_bytes([3; 32]).expect("fixture key");
    let encrypted = nip49::encrypt(&key, "password", 8, 1, &[4; 16], &[5; 24])
        .expect("fixture envelope")
        .encode()
        .expect("encode");
    (encrypted, key.public_key())
}
fn unsigned(pubkey: &str) -> p::UnsignedNostrEvent {
    p::UnsignedNostrEvent {
        pubkey: pubkey.into(),
        created_at: 1700000000,
        kind: 1,
        tags: vec![],
        content: "vault signing fixture".into(),
    }
}
#[test]
fn encrypted_import_persists_only_ciphertext_and_locks_on_reload() {
    let (encrypted, pubkey) = envelope();
    let mut a = Accounts::default();
    a.import_encrypted(&encrypted, "password").expect("import");
    assert!(a.entries[0].encrypted());
    assert!(!a.entries[0].locked());
    let event = a.sign(&unsigned(&pubkey)).expect("sign").expect("local");
    assert!(matches!(
        p::verify_event(&event),
        p::VerificationResult::Ok(_)
    ));
    let stored = serde_json::to_string(&a).expect("storage");
    assert!(stored.contains(&encrypted));
    assert!(!stored.contains("password"));
    assert!(!stored.contains(&lkjstr_nips::hex(&[3; 32])));
    assert!(!stored.contains("unlocked_key"));
    let mut restored: Accounts = serde_json::from_str(&stored).expect("restore");
    assert!(restored.entries[0].locked());
    assert!(matches!(
        restored.require_signer(&pubkey),
        Err("signer-missing")
    ));
    assert!(matches!(
        restored.sign(&unsigned(&pubkey)),
        Err("signer-missing")
    ));
    assert!(matches!(
        restored.backup_key(&pubkey),
        Err("signer-missing")
    ));
    assert!(matches!(restored.unlock(&pubkey, "wrong"), Err("rejected")));
    assert_eq!(serde_json::to_string(&restored).expect("unchanged"), stored);
    restored.unlock(&pubkey, "password").expect("unlock");
    assert!(restored.sign(&unsigned(&pubkey)).expect("sign").is_some());
    assert_eq!(
        serde_json::to_string(&restored).expect("session-only"),
        stored
    );
    restored.lock(&pubkey).expect("lock");
    assert!(restored.entries[0].locked());
    assert!(matches!(
        restored.crypt(&pubkey, &pubkey, "nip44.encrypt", "private", &[9; 32]),
        Err("signer-missing")
    ));
}
#[test]
fn failed_import_preserves_existing_account_then_explicit_import_replaces_plaintext() {
    let (encrypted, pubkey) = envelope();
    let nsec = p::encode_nsec(&lkjstr_nips::hex(&[3; 32])).expect("fixture nsec");
    let mut a = Accounts::default();
    a.add("key", Some(&nsec)).expect("plain import");
    let stored = serde_json::to_string(&a).expect("plain snapshot");
    assert!(!a.entries[0].encrypted());
    assert_eq!(a.backup_key(&pubkey).expect("backup"), nsec);
    assert!(a.import_encrypted(&encrypted, "wrong").is_err());
    assert_eq!(serde_json::to_string(&a).expect("unchanged"), stored);
    let restored: Accounts = serde_json::from_str(&stored).expect("legacy storage");
    assert!(
        restored
            .sign(&unsigned(&pubkey))
            .expect("legacy still signs")
            .is_some()
    );
    a.import_encrypted(&encrypted, "password")
        .expect("explicit replacement");
    assert_eq!(a.entries.len(), 1);
    assert!(
        !serde_json::to_string(&a)
            .expect("vault")
            .contains(&lkjstr_nips::hex(&[3; 32]))
    );
    a.add("key", Some(&p::encode_npub(&pubkey).expect("npub")))
        .expect("read-only import");
    assert!(
        a.entries[0].encrypted(),
        "npub does not downgrade a saved signer"
    );
}
#[test]
fn export_is_explicit_and_does_not_change_saved_key_protection() {
    let nsec = p::encode_nsec(&lkjstr_nips::hex(&[3; 32])).expect("fixture");
    let mut a = Accounts::default();
    a.add("key", Some(&nsec)).expect("plain import");
    let pubkey = a.active.clone().expect("active");
    let before = serde_json::to_string(&a).expect("before");
    for (password, log_n, error) in [
        ("", 16, "rejected"),
        ("password", 15, "rejected"),
        ("password", 19, "too-large"),
        ("password", 255, "too-large"),
    ] {
        assert_eq!(
            a.export_encrypted(&pubkey, password, log_n, &[4; 16], &[5; 24])
                .err(),
            Some(error)
        );
    }
    let exported = a
        .export_encrypted(&pubkey, "export password", 16, &[4; 16], &[5; 24])
        .expect("export");
    let parsed = nip49::EncryptedKey::parse(&exported).expect("envelope");
    assert_eq!(
        parsed.security(),
        0,
        "legacy plaintext exposure is recorded"
    );
    assert_eq!(parsed.log_n(), 16);
    assert_eq!(
        parsed
            .decrypt("export password")
            .expect("decrypt backup")
            .public_key(),
        pubkey
    );
    assert_eq!(serde_json::to_string(&a).expect("unchanged"), before);
    assert_eq!(a.lock(&pubkey).err(), Some("unsupported"));
}
#[test]
fn account_key_mismatch_and_external_signers_never_export_local_secrets() {
    let (encrypted, pubkey) = envelope();
    let mut a = Accounts::default();
    a.import_encrypted(&encrypted, "password").expect("import");
    let mut saved = serde_json::to_value(&a).expect("saved");
    let other = SecretKey::from_bytes([8; 32]).expect("other").public_key();
    saved["entries"][0]["pubkey"] = json!(other);
    let mut corrupt: Accounts = serde_json::from_value(saved).expect("read corrupt record");
    assert_eq!(corrupt.unlock(&other, "password").err(), Some("rejected"));
    assert!(corrupt.entries[0].locked());
    a.add("extension", Some(&pubkey)).expect("replace signer");
    assert!(!a.entries[0].encrypted());
    assert_eq!(
        a.export_encrypted(&pubkey, "password", 16, &[4; 16], &[5; 24])
            .err(),
        Some("unsupported")
    );
    assert_eq!(a.unlock(&pubkey, "password").err(), Some("unsupported"));
}
#[test]
fn key_actions_results_and_owned_password_debug_are_redacted() {
    let (encrypted, pubkey) = envelope();
    for action in [
        json!({"a":"account.importEncrypted","key":encrypted,"password":"password-marker"}),
        json!({"a":"account.unlock","pubkey":pubkey,"password":"password-marker"}),
        json!({"a":"account.lock","pubkey":pubkey}),
        json!({"a":"account.exportEncrypted","pubkey":pubkey,"password":"password-marker","logN":16}),
    ] {
        let input: Input =
            serde_json::from_value(json!({"t":"act","req":"key-test","action":action}))
                .expect("additive action");
        assert!(!format!("{input:?}").contains("password-marker"));
        assert!(!format!("{input:?}").contains(&encrypted));
    }
    let result = Output::Result {
        req: "export".into(),
        ok: true,
        error: None,
        delivery: None,
        id: None,
        uploaded: None,
        key: None,
        encrypted_key: Some(encrypted.clone()),
        dm_draft: None,
        dm_draft_revision: None,
        dm_delivery: None,
        cancelled: None,
        zap_intent: None,
    };
    assert!(!format!("{result:?}").contains(&encrypted));
    let encoded = serde_json::to_value(result).expect("wire result");
    assert_eq!(encoded["encryptedKey"], encrypted);
    assert!(encoded.get("key").is_none());
    let password = lkjstr_core::engine::accounts::secret::SecretText::new("password-marker".into());
    assert!(!format!("{password:?}").contains("password-marker"));
}
