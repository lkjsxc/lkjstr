#![allow(clippy::unwrap_used)]
mod common;
use common::{fixed, key, tag, unsigned};
use lkjstr_nips::{
    dm,
    event::Event,
    gift::{self, WrapParameters},
    keys::SecretKey,
    list_crypto,
};

#[test]
fn official_nip59_example_authenticates_and_unwraps() {
    let recipient = SecretKey::from_bytes(fixed(
        "e108399bd8424357a710b606ae0c13166d853d327e47a6e5e038197346bdbf45",
    ))
    .unwrap();
    let event = Event::parse(include_str!("vectors/nip59-5.json"), 16384).unwrap();
    let expected: lkjstr_nips::event::Rumor =
        serde_json::from_str(include_str!("vectors/nip59-3.json")).unwrap();
    assert_eq!(gift::unwrap(&event, &recipient).unwrap(), expected);
}
#[test]
fn wrap_to_every_participant_including_sender_and_inbox_routing() {
    let (sender, recipient, ephemeral) = (key(1), key(2), key(3));
    let rumor = dm::message(
        sender.public_key(),
        &[recipient.public_key()],
        "secret hello",
        1700000000,
        None,
        Some("chat"),
    )
    .unwrap();
    let participants = dm::participants(&rumor).unwrap();
    assert_eq!(participants.len(), 2);
    for (index, receiver) in [&sender, &recipient].into_iter().enumerate() {
        let params = WrapParameters {
            ephemeral: &ephemeral,
            now: 1700000100,
            seal_age: 100,
            wrap_age: 200,
            seal_nonce: [index as u8 + 1; 32],
            wrap_nonce: [index as u8 + 2; 32],
            seal_aux: [3; 32],
            wrap_aux: [4; 32],
        };
        let event = dm::wrap(&rumor, &sender, &receiver.public_bytes(), &params).unwrap();
        assert_eq!(event.data.kind, 1059);
        assert_eq!(event.data.created_at, 1699999900);
        assert_eq!(gift::unwrap(&event, receiver).unwrap(), rumor);
        assert_eq!(dm::unwrap(&event, receiver).unwrap(), rumor);
        assert!(gift::unwrap(&event, &key(4)).is_err());
        assert!(!event.to_json().unwrap().contains("secret hello"));
    }
    let inbox = lkjstr_nips::event::UnsignedEvent::new(
        recipient.public_key(),
        1,
        10050,
        vec![tag(&["relay", "wss://inbox.example"])],
        "",
    )
    .sign(&recipient, &[2; 32])
    .unwrap();
    assert_eq!(
        dm::inbox_relays(Some(&inbox), &recipient.public_key()).unwrap(),
        vec!["wss://inbox.example/"]
    );
    assert!(dm::inbox_relays(None, &recipient.public_key()).is_err());
    assert!(dm::inbox_relays(Some(&inbox), &sender.public_key()).is_err());
}
#[test]
fn dm_room_members_reply_validation_and_private_lists() {
    let owner = key(1);
    let rumor = dm::message(
        owner.public_key(),
        &[key(2).public_key(), key(2).public_key()],
        "hi",
        10,
        Some(&"ab".repeat(32)),
        None,
    )
    .unwrap();
    assert_eq!(dm::participants(&rumor).unwrap().len(), 2);
    assert!(dm::message(owner.public_key(), &[], "hi", 1, None, None).is_err());
    assert!(dm::message(owner.public_key(), &["bad".into()], "hi", 1, None, None).is_err());
    let entries = vec![tag(&["p", &key(2).public_key()]), tag(&["word", "muted"])];
    let ciphertext = list_crypto::encrypt(&entries, &owner, &[8; 32]).unwrap();
    let list = unsigned(10000, vec![], &ciphertext)
        .sign(&owner, &[9; 32])
        .unwrap();
    assert_eq!(list_crypto::decrypt(&list, &owner).unwrap(), entries);
    assert!(list_crypto::decrypt(&list, &key(2)).is_err());
    let empty = unsigned(10000, vec![], "").sign(&owner, &[9; 32]).unwrap();
    assert!(list_crypto::decrypt(&empty, &owner).unwrap().is_empty());
}
