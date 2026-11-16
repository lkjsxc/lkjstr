#![allow(clippy::expect_used)]
//! Replacing a usable signer changes private authority without serializing identity state.
use lkjstr_core::engine::accounts::Accounts;
use lkjstr_nips::{keys::SecretKey, nip49};
use lkjstr_protocol as p;
fn owner() -> String {
    SecretKey::from_bytes([3; 32])
        .expect("fixture")
        .public_key()
}
#[test]
fn unchanged_selection_and_read_only_import_preserve_authority() {
    let key = owner();
    let mut accounts = Accounts::default();
    accounts.add("extension", Some(&key)).expect("fixture");
    let first = accounts.entries[0].authority();
    accounts.use_account(&key).expect("fixture");
    accounts.seen.insert(key.clone(), 17);
    accounts
        .add("key", Some(&p::encode_npub(&key).expect("fixture")))
        .expect("fixture");
    assert_eq!(accounts.entries[0].authority(), first);
    let persisted = serde_json::to_string(&accounts).expect("fixture");
    accounts.add("extension", Some(&key)).expect("fixture");
    assert_ne!(accounts.entries[0].authority(), first);
    assert_eq!(accounts.seen[&key], 17);
    assert_eq!(
        serde_json::to_string(&accounts).expect("fixture"),
        persisted
    );
    assert!(!persisted.contains("authority"));
}
#[test]
fn same_pubkey_bunker_replacement_invalidates_old_authority() {
    let key = owner();
    let remote = || {
        p::remote::Remote::parse(&format!("bunker://{key}?relay=ws://127.0.0.1:1"))
            .expect("fixture")
            .0
    };
    let mut accounts = Accounts::default();
    accounts.add_remote(key.clone(), remote()).expect("fixture");
    let first = accounts.entries[0].authority();
    accounts.add_remote(key.clone(), remote()).expect("fixture");
    let second = accounts.entries[0].authority();
    assert_ne!(first, second);
    accounts.add("extension", Some(&key)).expect("fixture");
    assert_ne!(accounts.entries[0].authority(), second);
}
#[test]
fn successful_encrypted_migration_refreshes_authority_but_failure_does_not() {
    let key = SecretKey::from_bytes([3; 32]).expect("fixture");
    let encoded = nip49::encrypt(&key, "fixture", 8, 1, &[4; 16], &[5; 24])
        .expect("fixture")
        .encode()
        .expect("fixture");
    let pubkey = key.public_key();
    let mut accounts = Accounts::default();
    accounts.add("extension", Some(&pubkey)).expect("fixture");
    accounts.seen.insert(pubkey.clone(), 29);
    let first = accounts.entries[0].authority();
    assert!(accounts.import_encrypted(&encoded, "incorrect").is_err());
    assert_eq!(accounts.entries[0].authority(), first);
    accounts
        .import_encrypted(&encoded, "fixture")
        .expect("fixture");
    assert_ne!(accounts.entries[0].authority(), first);
    assert_eq!(accounts.seen[&pubkey], 29);
    let persisted = serde_json::to_string(&accounts).expect("fixture");
    assert!(persisted.contains(&encoded));
    assert!(!persisted.contains("authority"));
    let restored: Accounts = serde_json::from_str(&persisted).expect("fixture");
    assert!(restored.entries[0].locked());
}
