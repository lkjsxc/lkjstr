use lkjstr_protocol::{
    AddressPointer, EventPointer, NostrEntity, ProfilePointer, decode_nip19, encode_naddr,
    encode_nevent, encode_nip19, encode_note, encode_nprofile, encode_npub, encode_nsec,
    generate_secret_key, public_key_from_secret,
};

#[test]
fn roundtrips_scalar_entities() -> Result<(), String> {
    let secret = generate_secret_key();
    let secret_hex = lkjstr_protocol::bytes_to_hex(secret.as_bytes());
    let pubkey = public_key_from_secret(&secret).map_err(|error| format!("{error:?}"))?;
    let id = "ab".repeat(32);
    assert_eq!(
        decode_nip19(&encode_npub(&pubkey).map_err(|error| format!("{error:?}"))?),
        Some(NostrEntity::Npub(pubkey))
    );
    assert_eq!(
        decode_nip19(&encode_note(&id).map_err(|error| format!("{error:?}"))?),
        Some(NostrEntity::Note(id))
    );
    assert_eq!(
        decode_nip19(&encode_nsec(&secret_hex).map_err(|error| format!("{error:?}"))?),
        Some(NostrEntity::Nsec(secret_hex.clone()))
    );
    assert!(!format!("{:?}", NostrEntity::Nsec(secret_hex.clone())).contains(&secret_hex));
    Ok(())
}

#[test]
fn roundtrips_tlv_entities() -> Result<(), String> {
    let pubkey = "11".repeat(32);
    let id = "22".repeat(32);
    let relay = vec!["wss://relay.example".to_owned()];
    assert_eq!(
        decode_nip19(
            &encode_nprofile(&ProfilePointer {
                pubkey: pubkey.clone(),
                relays: Some(relay.clone()),
            })
            .map_err(|error| format!("{error:?}"))?
        ),
        Some(NostrEntity::Nprofile(ProfilePointer {
            pubkey: pubkey.clone(),
            relays: Some(relay.clone()),
        }))
    );
    assert_eq!(
        decode_nip19(
            &encode_nevent(&EventPointer {
                id: id.clone(),
                relays: Some(vec!["wss://r".to_owned()]),
                author: Some(pubkey.clone()),
                kind: Some(1),
            })
            .map_err(|error| format!("{error:?}"))?
        ),
        Some(NostrEntity::Nevent(EventPointer {
            id,
            relays: Some(vec!["wss://r".to_owned()]),
            author: Some(pubkey.clone()),
            kind: Some(1),
        }))
    );
    assert_eq!(
        decode_nip19(
            &encode_naddr(&AddressPointer {
                identifier: "name".to_owned(),
                pubkey: pubkey.clone(),
                kind: 30023,
                relays: None,
            })
            .map_err(|error| format!("{error:?}"))?
        ),
        Some(NostrEntity::Naddr(AddressPointer {
            identifier: "name".to_owned(),
            pubkey,
            kind: 30023,
            relays: None,
        }))
    );
    Ok(())
}

#[test]
fn rejects_malformed_and_oversized_values() {
    assert_eq!(decode_nip19("not-an-entity"), None);
    assert_eq!(decode_nip19(&format!("npub1{}", "q".repeat(5000))), None);
    assert!(encode_npub("bad").is_err());
    assert!(encode_nip19(&NostrEntity::Note("ff".to_owned())).is_err());
}
