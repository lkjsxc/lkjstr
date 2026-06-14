use lkjstr_app::{
    ProfileHeaderInput, profile_header_view, profile_header_with_relays, profile_npub,
    relay_sets_copy_json,
};
use lkjstr_domain::{RelayConnectionState, RelayHealth, RelayPurpose, RelayRecord, RelaySet};
use lkjstr_protocol::{KIND_FOLLOW_LIST, KIND_METADATA, NostrEntity, NostrEvent, decode_nip19};
use serde_json::Value;

#[test]
fn profile_header_uses_cached_metadata_and_known_follow_count() -> Result<(), String> {
    let author = pubkey("a");
    let metadata = event(
        &author,
        KIND_METADATA,
        concat!(
            r#"{"display_name":"Rustacean","nip05":"rust@example.com","#,
            r#""about":"about text","website":"example.com","#,
            r#""picture":"https://media.example/avatar.png","#,
            r#""banner":"https://media.example/banner.png"}"#,
        ),
        Vec::new(),
    );
    let follow_list = event(
        &author,
        KIND_FOLLOW_LIST,
        "",
        vec![
            vec!["p".to_owned(), pubkey("b")],
            vec!["p".to_owned(), pubkey("b")],
            vec!["p".to_owned(), pubkey("c")],
            vec!["p".to_owned(), "bad".to_owned()],
        ],
    );

    let header = profile_header_view(ProfileHeaderInput {
        pubkey: &author,
        metadata_event: Some(&metadata),
        follow_list_event: Some(&follow_list),
    });

    assert_eq!(header.display_name, "Rustacean");
    assert_eq!(header.subtitle, "rust@example.com");
    assert_eq!(
        header.avatar_url.as_deref(),
        Some("https://media.example/avatar.png")
    );
    assert_eq!(
        header.banner_url.as_deref(),
        Some("https://media.example/banner.png")
    );
    assert_eq!(header.about.as_deref(), Some("about text"));
    assert_eq!(header.website.as_deref(), Some("https://example.com"));
    assert_eq!(header.following_label, "2 following");
    assert!(header.following_known);
    let copy_json = json(&header.follow_list_json)?;
    assert_eq!(copy_json["kind"], KIND_FOLLOW_LIST);
    assert_eq!(copy_json["pubkey"], author);
    Ok(())
}

#[test]
fn profile_header_never_turns_unknown_follow_list_into_zero() {
    let author = pubkey("a");
    let header = profile_header_view(ProfileHeaderInput {
        pubkey: &author,
        metadata_event: None,
        follow_list_event: None,
    });

    assert_eq!(header.following_label, "Loading following...");
    assert!(!header.following_known);
    assert_eq!(header.follow_list_json, "null");
    assert_ne!(header.following_label, "0 following");
}

#[test]
fn profile_header_nprofile_preserves_relay_hints() -> Result<(), String> {
    let author = pubkey("a");
    let header = profile_header_view(ProfileHeaderInput {
        pubkey: &author,
        metadata_event: None,
        follow_list_event: None,
    });
    let header = profile_header_with_relays(header, &["wss://selected.example".to_owned()]);
    let value = header
        .nprofile
        .as_deref()
        .ok_or_else(|| "missing nprofile".to_owned())?;
    let Some(NostrEntity::Nprofile(pointer)) = decode_nip19(value) else {
        return Err(format!("unexpected nprofile payload: {value}"));
    };

    assert_eq!(pointer.pubkey, author);
    assert_eq!(
        pointer.relays,
        Some(vec!["wss://selected.example".to_owned()])
    );
    Ok(())
}

#[test]
fn profile_npub_encodes_pubkeys_and_preserves_invalid_input() -> Result<(), String> {
    let author = pubkey("a");
    let value = profile_npub(&author);
    let Some(NostrEntity::Npub(decoded)) = decode_nip19(&value) else {
        return Err(format!("unexpected npub payload: {value}"));
    };

    assert_eq!(decoded, author);
    assert_eq!(profile_npub("bad"), "bad");
    Ok(())
}

#[test]
fn relay_sets_copy_json_matches_svelte_profile_contract() -> Result<(), String> {
    let relay_set = RelaySet {
        id: "discovery-default".to_owned(),
        name: "Discovery Default".to_owned(),
        purpose: RelayPurpose::Discovery,
        is_default: None,
        seeded: true,
        relays: vec![relay_record("https://relay.example//path?b=2&a=1#old")],
        updated_at: 123,
    };

    let value = json(&relay_sets_copy_json(&[relay_set]))?;

    assert_eq!(
        value,
        serde_json::json!([{
            "id": "discovery-default",
            "name": "Discovery Default",
            "default": false,
            "relays": [{
                "url": "wss://relay.example/path?a=1&b=2",
                "enabled": false,
                "read": true,
                "write": false
            }]
        }])
    );
    assert!(value[0].get("purpose").is_none());
    assert!(value[0]["relays"][0].get("health").is_none());
    Ok(())
}

fn event(pubkey: &str, kind: u64, content: &str, tags: Vec<Vec<String>>) -> NostrEvent {
    NostrEvent {
        id: format!("{kind:064x}"),
        pubkey: pubkey.to_owned(),
        created_at: 1,
        kind,
        tags,
        content: content.to_owned(),
        sig: "f".repeat(128),
    }
}

fn relay_record(url: &str) -> RelayRecord {
    RelayRecord {
        url: url.to_owned(),
        label: "Relay".to_owned(),
        enabled: false,
        read: true,
        write: false,
        state: RelayConnectionState::Open,
        last_error: Some("hidden".to_owned()),
        last_connected_at: Some(2),
        updated_at: 3,
        health: RelayHealth {
            attempts: 1,
            successes: 1,
            failures: 0,
        },
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

fn json(value: &str) -> Result<Value, String> {
    serde_json::from_str(value).map_err(|error| error.to_string())
}
