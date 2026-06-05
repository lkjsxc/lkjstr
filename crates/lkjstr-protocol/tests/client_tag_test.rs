use lkjstr_protocol::{
    ClientTagConfig, ClientTagError, ClientTagPolicy, KIND_HTTP_AUTH, KIND_TEXT_NOTE,
    append_client_tag, client_tag_allowed_for_kind, client_tag_parts, parse_client_tag,
};

fn config() -> ClientTagConfig {
    ClientTagConfig {
        policy: ClientTagPolicy::Enabled,
        name: " lkjstr ".to_owned(),
        address: format!("31990:{}:lkjstr", "A".repeat(64)),
        relay: "relay.example".to_owned(),
    }
}

#[test]
fn client_tag_builder_normalizes_valid_parts() -> Result<(), ClientTagError> {
    let tag = client_tag_parts(&config())?;

    assert_eq!(tag[0], "client");
    assert_eq!(tag[1], "lkjstr");
    assert_eq!(tag[2], format!("31990:{}:lkjstr", "a".repeat(64)));
    assert_eq!(tag[3], "wss://relay.example/");
    Ok(())
}

#[test]
fn client_tag_builder_rejects_bad_config() {
    let mut disabled = config();
    disabled.policy = ClientTagPolicy::Disabled;
    assert_eq!(client_tag_parts(&disabled), Err(ClientTagError::Disabled));

    let mut bad_address = config();
    bad_address.address = format!("31989:{}:lkjstr", "a".repeat(64));
    assert_eq!(
        client_tag_parts(&bad_address),
        Err(ClientTagError::BadAddress)
    );

    let mut bad_relay = config();
    bad_relay.relay = "ftp://relay.example".to_owned();
    assert_eq!(client_tag_parts(&bad_relay), Err(ClientTagError::BadRelay));
}

#[test]
fn append_client_tag_replaces_existing_only_for_allowed_kinds() {
    let tags = vec![vec!["client".to_owned(), "old".to_owned()]];
    let enriched = append_client_tag(tags.clone(), &config(), KIND_TEXT_NOTE);
    assert_eq!(enriched.len(), 1);
    assert_eq!(enriched[0][1], "lkjstr");

    let auth_tags = append_client_tag(tags, &config(), KIND_HTTP_AUTH);
    assert!(auth_tags.is_empty());
    assert!(!client_tag_allowed_for_kind(KIND_HTTP_AUTH));
}

#[test]
fn parse_client_tag_ignores_malformed_tags() -> Result<(), &'static str> {
    let tags = vec![vec![
        "client".to_owned(),
        "lkjstr".to_owned(),
        format!("31990:{}:lkjstr", "b".repeat(64)),
        "https://relay.example/path//".to_owned(),
    ]];
    let parsed = parse_client_tag(&tags).ok_or("missing valid client tag")?;

    assert_eq!(parsed.name, "lkjstr");
    assert_eq!(parsed.relay, "wss://relay.example/path");
    assert!(parse_client_tag(&[vec!["client".to_owned(), "bad".to_owned()]]).is_none());
    Ok(())
}
