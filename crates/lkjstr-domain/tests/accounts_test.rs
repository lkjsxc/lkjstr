use lkjstr_domain::{
    SignerType, create_account, create_local_account_record, estimated_attempts, generate_nsec,
    normalize_account, npub_matches_prefix, parse_npub_prefix, parse_nsec, parse_readonly_account,
    short_key, sign_local_event,
};
use lkjstr_protocol::{
    UnsignedNostrEvent, bytes_to_hex, encode_npub, parse_secret_key_hex, public_key_from_secret,
    verify_event,
};

#[test]
fn parses_readonly_accounts_and_capabilities() -> Result<(), String> {
    let pubkey = "aa".repeat(32);
    let account = parse_readonly_account(&format!(" {} ", pubkey), 10).ok_or("readonly account")?;
    assert_eq!(account.signer_type, SignerType::Readonly);
    assert_eq!(account.pubkey, pubkey);
    assert_eq!(account.label, "aaaaaaaa:aaaaaa");
    assert!(!account.capabilities.sign);
    assert_eq!(
        parse_readonly_account(
            &encode_npub(&pubkey).map_err(|error| format!("{error:?}"))?,
            10
        )
        .ok_or("npub account")?
        .pubkey,
        pubkey
    );
    assert!(parse_readonly_account("not-a-key", 10).is_none());
    assert!(
        create_account(&pubkey, SignerType::Local, 10)
            .ok_or("local")?
            .capabilities
            .publish
    );
    Ok(())
}

#[test]
fn normalizes_account_records() -> Result<(), String> {
    let pubkey = "aa".repeat(32);
    let mut account = create_account(&pubkey, SignerType::Readonly, 10).ok_or("account")?;
    account.enabled = false;
    let normalized = normalize_account(&account);
    assert!(normalized.enabled);
    assert_eq!(short_key(&pubkey), "aaaaaaaa:aaaaaa");
    Ok(())
}

#[test]
fn serializes_account_rows_for_storage_manifest() -> Result<(), String> {
    let pubkey = "aa".repeat(32);
    let account = create_account(&pubkey, SignerType::Nip07, 10).ok_or("account")?;
    let json = serde_json::to_value(&account).map_err(|error| error.to_string())?;
    assert_eq!(json["signerType"], "nip07");
    assert_eq!(json["updatedAt"], 10);
    assert!(json.get("signer_type").is_none());
    Ok(())
}

#[test]
fn creates_local_records_and_signs_events() -> Result<(), String> {
    let secret = parse_secret_key_hex(&"01".repeat(32)).ok_or("secret")?;
    let (account, secret_row) =
        create_local_account_record(Some(&secret), 10).map_err(|error| format!("{error:?}"))?;
    assert_eq!(
        account.pubkey,
        public_key_from_secret(&secret).map_err(|error| format!("{error:?}"))?
    );
    assert_eq!(secret_row.secret_key, bytes_to_hex(secret.as_bytes()));
    let json = serde_json::to_value(&secret_row).map_err(|error| error.to_string())?;
    assert_eq!(json["accountId"], account.id);
    assert!(json.get("secret_key").is_none());
    assert!(!format!("{secret_row:?}").contains(&secret_row.secret_key));
    let event = sign_local_event(
        &UnsignedNostrEvent {
            pubkey: account.pubkey.clone(),
            created_at: 1,
            kind: 1,
            tags: Vec::new(),
            content: "local note".to_owned(),
        },
        &secret_row.secret_key,
    )
    .map_err(|error| format!("{error:?}"))?;
    assert!(matches!(
        verify_event(&event),
        lkjstr_protocol::VerificationResult::Ok(_)
    ));
    assert!(parse_nsec(&generate_nsec()).is_some());
    Ok(())
}

#[test]
fn validates_npub_mining_prefixes() -> Result<(), String> {
    assert_eq!(
        parse_npub_prefix(" NPub1acd ").map(|value| value.prefix),
        Ok("acd".to_owned())
    );
    assert!(parse_npub_prefix("").is_err());
    assert!(parse_npub_prefix(&"a".repeat(9)).is_err());
    assert!(parse_npub_prefix("bio").is_err());
    let npub = encode_npub(&"aa".repeat(32)).map_err(|error| format!("{error:?}"))?;
    assert!(npub_matches_prefix(&npub, &npub[5..7]));
    assert!(!npub_matches_prefix(&npub, "zz"));
    assert_eq!(estimated_attempts("ab"), 1024);
    Ok(())
}
