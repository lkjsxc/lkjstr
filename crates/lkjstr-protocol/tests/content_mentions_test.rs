use lkjstr_protocol::{
    ContentProfileMention, ProfilePointer, content_profile_mentions, encode_note, encode_nprofile,
    encode_npub,
};

#[test]
fn extracts_profile_mentions_with_raw_spans() -> Result<(), String> {
    let pubkey = "1".repeat(64);
    let npub = encode_npub(&pubkey).map_err(|error| format!("{error:?}"))?;
    let content = format!("hi nostr:{npub}!");

    assert_eq!(
        content_profile_mentions(&content),
        vec![ContentProfileMention {
            pubkey: pubkey.clone(),
            relays: Vec::new(),
            raw: format!("nostr:{npub}"),
            start: 3,
            end: 3 + 6 + npub.len(),
        }]
    );
    Ok(())
}

#[test]
fn extracts_nprofile_relay_hints_and_ignores_event_entities() -> Result<(), String> {
    let pubkey = "2".repeat(64);
    let nprofile = encode_nprofile(&ProfilePointer {
        pubkey: pubkey.clone(),
        relays: Some(vec!["wss://relay.example".to_owned()]),
    })
    .map_err(|error| format!("{error:?}"))?;
    let note = encode_note(&"3".repeat(64)).map_err(|error| format!("{error:?}"))?;
    let content = format!("nostr:{nprofile} nostr:{note}");

    assert_eq!(
        content_profile_mentions(&content),
        vec![ContentProfileMention {
            pubkey,
            relays: vec!["wss://relay.example".to_owned()],
            raw: format!("nostr:{nprofile}"),
            start: 0,
            end: 6 + nprofile.len(),
        }]
    );
    Ok(())
}
