#![allow(clippy::unwrap_used)]
mod common;
use common::key;
use lkjstr_nips::{
    dm,
    gift::{self, WrapParameters},
};

#[test]
fn private_messages_reject_nonparticipant_delivery_even_with_valid_wrapping() {
    let ephemeral = key(3);
    let params = WrapParameters {
        ephemeral: &ephemeral,
        now: 1000,
        seal_age: 20,
        wrap_age: 30,
        seal_nonce: [1; 32],
        wrap_nonce: [2; 32],
        seal_aux: [3; 32],
        wrap_aux: [4; 32],
    };
    let rumor = dm::message(
        key(1).public_key(),
        &[key(2).public_key()],
        "hi",
        1000,
        None,
        None,
    )
    .unwrap();
    assert!(dm::wrap(&rumor, &key(1), &key(4).public_bytes(), &params).is_err());
    let wrap = gift::wrap(&rumor, &key(1), &key(4).public_bytes(), &params).unwrap();
    assert!(gift::unwrap(&wrap, &key(4)).is_ok());
    assert!(dm::unwrap(&wrap, &key(4)).is_err());
}
