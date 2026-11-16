#![allow(clippy::expect_used)]
use lkjstr_core::engine::dm::drafts::{self, Catalog, Envelope, State};
use lkjstr_nips::{keys::SecretKey, nip44};
fn account() -> String {
    lkjstr_nips::hex(
        &SecretKey::from_bytes([7; 32])
            .expect("valid test fixture")
            .public_bytes(),
    )
}
fn setup() -> (String, drafts::PreparedSeed, String) {
    let account = account();
    let seed = drafts::prepare_seed(&account, [4; 32]).expect("valid test fixture");
    let secret = SecretKey::from_bytes([7; 32]).expect("valid test fixture");
    let key = nip44::conversation_key(&secret, &secret.public_bytes()).expect("valid test fixture");
    let wrapped = nip44::encrypt(&seed.payload, &key, &[2; 32]).expect("valid test fixture");
    (account, seed, wrapped)
}
fn catalog() -> Catalog {
    let mut catalog = Catalog::default();
    for i in 0..6 {
        let mut state = State::default();
        state.draft.text = "private marker é".repeat(10_000);
        catalog
            .apply(&format!("tab-{i}"), Some(state), None)
            .expect("valid test fixture");
    }
    catalog
}
fn seal(
    account: &str,
    catalog: &Catalog,
    seed: &drafts::PreparedSeed,
    wrapped: String,
    batch: u8,
) -> Envelope {
    let mut nonce = 0u8;
    drafts::seal(
        account,
        catalog,
        &seed.key,
        wrapped,
        &format!("{batch:032x}"),
        || {
            nonce += 1;
            Ok([nonce; 32])
        },
    )
    .expect("valid test fixture")
}
#[test]
fn purpose_bound_seed_and_segmented_catalog_survive_restart() {
    let (account, seed, wrapped) = setup();
    let catalog = catalog();
    let envelope = seal(&account, &catalog, &seed, wrapped, 1);
    assert!(envelope.cipher_catalog.len() > 1);
    let raw = envelope.encoded().expect("valid test fixture");
    assert!(!raw.contains("private marker"));
    assert!(!raw.contains("tab-0"));
    let loaded = Envelope::parse(&raw).expect("valid test fixture");
    let secret = SecretKey::from_bytes([7; 32]).expect("valid test fixture");
    let key = nip44::conversation_key(&secret, &secret.public_bytes()).expect("valid test fixture");
    let payload = nip44::decrypt(&loaded.wrapped_seed, &key).expect("valid test fixture");
    let unwrapped = drafts::open_seed(&account, &payload).expect("valid test fixture");
    let decoded = drafts::open(&account, &loaded, &unwrapped).expect("valid test fixture");
    assert_eq!(
        decoded.get("tab-0").expect("valid test fixture").draft.text,
        catalog.get("tab-0").expect("valid test fixture").draft.text
    );
    assert!(drafts::open_seed(&"b".repeat(64), &payload).is_err());
    assert!(
        drafts::open_seed(
            &account,
            &payload.replace("lkjstr-private-drafts", "other-purpose")
        )
        .is_err()
    );
}
#[test]
fn swapped_truncated_mixed_or_tampered_segments_are_rejected() {
    let (account, seed, wrapped) = setup();
    let catalog = catalog();
    let raw = seal(&account, &catalog, &seed, wrapped.clone(), 1)
        .encoded()
        .expect("valid test fixture");
    let mut changed = Envelope::parse(&raw).expect("valid test fixture");
    changed.cipher_catalog.swap(0, 1);
    assert!(drafts::open(&account, &changed, &seed.key).is_err());
    changed = Envelope::parse(&raw).expect("valid test fixture");
    changed.cipher_catalog.pop();
    assert!(drafts::open(&account, &changed, &seed.key).is_err());
    let other = seal(&account, &catalog, &seed, wrapped, 2);
    changed = Envelope::parse(&raw).expect("valid test fixture");
    changed.cipher_catalog[1] = other.cipher_catalog[1].clone();
    assert!(drafts::open(&account, &changed, &seed.key).is_err());
    changed = Envelope::parse(&raw).expect("valid test fixture");
    changed.cipher_catalog[0].replace_range(16..17, "!");
    assert!(drafts::open(&account, &changed, &seed.key).is_err());
    assert!(
        drafts::open(
            &"b".repeat(64),
            &Envelope::parse(&raw).expect("valid test fixture"),
            &seed.key
        )
        .is_err()
    );
    let wrong = nip44::ConversationKey::from_bytes([9; 32]);
    assert!(
        drafts::open(
            &account,
            &Envelope::parse(&raw).expect("valid test fixture"),
            &wrong
        )
        .is_err()
    );
}

#[test]
fn heavily_escaped_catalog_stays_inside_the_encrypted_envelope_bound() {
    let (account, seed, wrapped) = setup();
    let mut catalog = Catalog::default();
    for index in 0..8 {
        let mut state = State::default();
        state.draft.text = "\\".repeat(120 * 1024);
        catalog
            .apply(&format!("escaped-{index}"), Some(state), None)
            .expect("valid test fixture");
    }
    let encrypted = seal(&account, &catalog, &seed, wrapped, 3);
    let restored = drafts::open(&account, &encrypted, &seed.key).expect("valid test fixture");
    assert_eq!(
        restored
            .get("escaped-7")
            .expect("valid test fixture")
            .draft
            .text
            .len(),
        120 * 1024
    );
    assert!(encrypted.encoded().expect("valid test fixture").len() < 6 * 1024 * 1024);
}
