use lkjstr_nips::{dm, event::UnsignedEvent, gift, gift_external, keys::SecretKey, nip44};
type Result = std::result::Result<(), Box<dyn std::error::Error>>;
#[test]
fn external_layers_match_local_unwrap_and_refuse_signed_or_foreign_rumors() -> Result {
    let a = SecretKey::from_bytes([1; 32])?;
    let b = SecretKey::from_bytes([2; 32])?;
    let e = SecretKey::from_bytes([3; 32])?;
    let rumor = dm::message(a.public_key(), &[b.public_key()], "private", 42, None, None)?;
    let params = gift::WrapParameters {
        ephemeral: &e,
        now: 100,
        seal_age: 10,
        wrap_age: 20,
        seal_nonce: [4; 32],
        wrap_nonce: [5; 32],
        seal_aux: [6; 32],
        wrap_aux: [7; 32],
    };
    let wrapped = dm::wrap(&rumor, &a, &b.public_bytes(), &params)?;
    gift_external::outer(&wrapped, &b.public_key())?;
    assert!(gift_external::outer(&wrapped, &a.public_key()).is_err());
    let outer_key = nip44::conversation_key(&b, &e.public_bytes())?;
    let sealed = nip44::decrypt(&wrapped.data.content, &outer_key)?;
    let seal = gift_external::seal(&sealed)?;
    let inner_key = nip44::conversation_key(&b, &a.public_bytes())?;
    let plaintext = nip44::decrypt(&seal.data.content, &inner_key)?;
    assert_eq!(
        gift_external::rumor(&seal, &plaintext, &b.public_key())?,
        rumor
    );
    let mut signed: serde_json::Value = serde_json::from_str(&plaintext)?;
    signed["sig"] = serde_json::json!("f".repeat(128));
    assert!(gift_external::rumor(&seal, &signed.to_string(), &b.public_key()).is_err());
    let c = SecretKey::from_bytes([8; 32])?;
    assert!(gift_external::rumor(&seal, &plaintext, &c.public_key()).is_err());
    let new_wrap = gift_external::wrap_seal(&seal, &b.public_bytes(), &params)?;
    assert_eq!(dm::unwrap(&new_wrap, &b)?, rumor);
    Ok(())
}
#[test]
fn legacy_membership_checks_authenticated_sender_and_recipient() -> Result {
    let a = SecretKey::from_bytes([1; 32])?;
    let b = SecretKey::from_bytes([2; 32])?;
    let event = UnsignedEvent::new(
        a.public_key(),
        42,
        4,
        vec![vec!["p".into(), b.public_key()]],
        "cipher",
    )
    .sign(&a, &[3; 32])?;
    assert_eq!(
        lkjstr_nips::nip04::peer(&event, &a.public_key())?,
        b.public_key()
    );
    assert_eq!(
        lkjstr_nips::nip04::peer(&event, &b.public_key())?,
        a.public_key()
    );
    assert!(lkjstr_nips::nip04::peer(&event, &"f".repeat(64)).is_err());
    assert!(lkjstr_nips::nip04::decrypt("bad?iv=AAAA", &a, &b.public_bytes()).is_err());
    Ok(())
}

#[test]
fn legacy_decrypt_matches_independent_aes_cbc_fixture() -> Result {
    let a = SecretKey::from_bytes([1; 32])?;
    let b = SecretKey::from_bytes([2; 32])?;
    let payload = "lo3G1VvN3Oz8VdmsMjjR3Q==?iv=BwcHBwcHBwcHBwcHBwcHBw==";
    assert_eq!(
        lkjstr_nips::nip04::decrypt(payload, &b, &a.public_bytes())?,
        "legacy fixture"
    );
    assert!(
        lkjstr_nips::nip04::decrypt(payload, &b, &SecretKey::from_bytes([4; 32])?.public_bytes())
            .is_err()
    );
    Ok(())
}
