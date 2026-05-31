use lkjstr_protocol::{
    EventTemplate, VerificationCode, VerificationResult, bytes_to_hex, compute_event_id,
    finalize_event, parse_secret_key_hex, public_key_from_secret, public_key_from_secret_hex,
    sign_schnorr_hex_with_secret_hex, verify_event, verify_schnorr_hex,
};

#[test]
fn derives_keys_and_parses_valid_secret_hex() -> Result<(), String> {
    let secret_hex = secret_hex();
    let secret =
        parse_secret_key_hex(&secret_hex).ok_or_else(|| "secret should parse".to_owned())?;
    assert_eq!(bytes_to_hex(secret.as_bytes()), secret_hex);
    assert_eq!(
        public_key_from_secret(&secret).map_err(|error| format!("{error:?}"))?,
        "1b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f"
    );
    assert_eq!(
        public_key_from_secret_hex(&secret_hex)
            .map_err(|error| format!("{error:?}"))?
            .len(),
        64
    );
    assert_eq!(parse_secret_key_hex("ff"), None);
    assert!(!format!("{secret:?}").contains(&secret_hex));
    Ok(())
}

#[test]
fn signs_and_verifies_schnorr_messages_as_hex() -> Result<(), String> {
    let secret_hex = secret_hex();
    let secret =
        parse_secret_key_hex(&secret_hex).ok_or_else(|| "secret should parse".to_owned())?;
    let event = finalize_event(&template(), &secret).map_err(|error| format!("{error:?}"))?;
    let id = compute_event_id(&event.to_unsigned()).map_err(|error| error.to_string())?;
    let sig =
        sign_schnorr_hex_with_secret_hex(&id, &secret_hex).map_err(|error| format!("{error:?}"))?;
    assert!(verify_schnorr_hex(&sig, &id, &event.pubkey));
    assert!(!verify_schnorr_hex(&sig, &"00".repeat(32), &event.pubkey));
    Ok(())
}

#[test]
fn verifies_events_and_detects_mutations() -> Result<(), String> {
    let secret =
        parse_secret_key_hex(&secret_hex()).ok_or_else(|| "secret should parse".to_owned())?;
    let event = finalize_event(&template(), &secret).map_err(|error| format!("{error:?}"))?;
    assert!(matches!(verify_event(&event), VerificationResult::Ok(_)));
    let mut changed = event;
    changed.content = "changed".to_owned();
    assert!(matches!(
        verify_event(&changed),
        VerificationResult::Err {
            code: VerificationCode::IdMismatch,
            ..
        }
    ));
    Ok(())
}

fn template() -> EventTemplate {
    EventTemplate {
        pubkey: None,
        created_at: 1,
        kind: 1,
        tags: Vec::new(),
        content: "sign".to_owned(),
    }
}

trait ToUnsigned {
    fn to_unsigned(&self) -> lkjstr_protocol::UnsignedNostrEvent;
}

impl ToUnsigned for lkjstr_protocol::NostrEvent {
    fn to_unsigned(&self) -> lkjstr_protocol::UnsignedNostrEvent {
        lkjstr_protocol::UnsignedNostrEvent {
            pubkey: self.pubkey.clone(),
            created_at: self.created_at,
            kind: self.kind,
            tags: self.tags.clone(),
            content: self.content.clone(),
        }
    }
}

fn secret_hex() -> String {
    "01".repeat(32)
}
