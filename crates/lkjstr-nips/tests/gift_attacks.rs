#![allow(clippy::unwrap_used)]
mod common;
use common::{key, tag};
use lkjstr_nips::{
    dm,
    event::UnsignedEvent,
    gift::{self, WrapParameters},
    nip44,
};

fn adversarial_wrap(
    text: &str,
    seal_tags: Vec<Vec<String>>,
    seal_kind: u16,
) -> lkjstr_nips::event::Event {
    let (sender, recipient, ephemeral) = (key(1), key(2), key(3));
    let conv = nip44::conversation_key(&sender, &recipient.public_bytes()).unwrap();
    let seal = UnsignedEvent::new(
        sender.public_key(),
        1,
        seal_kind,
        seal_tags,
        nip44::encrypt(text, &conv, &[1; 32]).unwrap(),
    )
    .sign(&sender, &[2; 32])
    .unwrap();
    let conv = nip44::conversation_key(&ephemeral, &recipient.public_bytes()).unwrap();
    UnsignedEvent::new(
        ephemeral.public_key(),
        1,
        1059,
        vec![tag(&["p", &recipient.public_key()])],
        nip44::encrypt(&seal.to_json().unwrap(), &conv, &[3; 32]).unwrap(),
    )
    .sign(&ephemeral, &[4; 32])
    .unwrap()
}
#[test]
fn seal_cannot_impersonate_a_different_rumor_author() {
    let rumor = dm::message(
        key(4).public_key(),
        &[key(2).public_key()],
        "forged author",
        1,
        None,
        None,
    )
    .unwrap();
    let event = adversarial_wrap(&serde_json::to_string(&rumor).unwrap(), vec![], 13);
    assert!(gift::unwrap(&event, &key(2)).is_err());
}
#[test]
fn reject_signed_rumors_bad_hashes_seal_tags_and_wrong_kinds() {
    let rumor = dm::message(
        key(1).public_key(),
        &[key(2).public_key()],
        "hello",
        1,
        None,
        None,
    )
    .unwrap();
    let text = serde_json::to_string(&rumor).unwrap();
    assert!(
        gift::unwrap(
            &adversarial_wrap(&text, vec![tag(&["p", &key(2).public_key()])], 13),
            &key(2)
        )
        .is_err()
    );
    assert!(gift::unwrap(&adversarial_wrap(&text, vec![], 1), &key(2)).is_err());
    let mut signed = serde_json::to_value(&rumor).unwrap();
    signed["sig"] = serde_json::json!("");
    assert!(gift::unwrap(&adversarial_wrap(&signed.to_string(), vec![], 13), &key(2)).is_err());
    let mut changed = rumor;
    changed.data.content = "tampered".into();
    assert!(
        gift::unwrap(
            &adversarial_wrap(&serde_json::to_string(&changed).unwrap(), vec![], 13),
            &key(2)
        )
        .is_err()
    );
}
#[test]
fn reject_wrong_sender_invalid_ages_and_tampered_outer_signatures() {
    let rumor = dm::message(
        key(1).public_key(),
        &[key(2).public_key()],
        "hello",
        1,
        None,
        None,
    )
    .unwrap();
    let ephemeral = key(3);
    let mut params = WrapParameters {
        ephemeral: &ephemeral,
        now: 1000,
        seal_age: 0,
        wrap_age: 0,
        seal_nonce: [1; 32],
        wrap_nonce: [2; 32],
        seal_aux: [3; 32],
        wrap_aux: [4; 32],
    };
    assert!(gift::wrap(&rumor, &key(4), &key(2).public_bytes(), &params).is_err());
    params.seal_age = 172800;
    assert!(gift::wrap(&rumor, &key(1), &key(2).public_bytes(), &params).is_err());
    params.seal_age = 0;
    let mut event = gift::wrap(&rumor, &key(1), &key(2).public_bytes(), &params).unwrap();
    event.sig = "00".repeat(64);
    assert!(gift::unwrap(&event, &key(2)).is_err());
}
