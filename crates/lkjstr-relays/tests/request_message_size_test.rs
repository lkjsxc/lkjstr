use lkjstr_protocol::NostrFilter;
use lkjstr_relays::{
    RequestMessageSizeCapSource, RequestMessageSizeDecision, app_max_req_message_bytes,
    estimate_req_message_bytes, request_message_size_decision,
};

#[test]
fn estimates_serialized_req_message_bytes() -> Result<(), String> {
    let bytes = estimate_req_message_bytes(
        "sub",
        &[NostrFilter {
            kinds: Some(vec![1]),
            ..NostrFilter::default()
        }],
    )
    .map_err(|error| error.to_string())?;

    assert_eq!(bytes, r#"["REQ","sub",{"kinds":[1]}]"#.len());
    Ok(())
}

#[test]
fn rejects_requests_over_relay_cap() -> Result<(), String> {
    let decision = request_message_size_decision(
        "wss://relay.example/",
        "sub",
        &[NostrFilter {
            search: Some("x".repeat(80)),
            ..NostrFilter::default()
        }],
        Some(30),
    )
    .map_err(|error| error.to_string())?;

    let RequestMessageSizeDecision::Reject(warning) = decision else {
        return Err("expected oversized rejection".to_owned());
    };
    assert_eq!(warning.relay_url, "wss://relay.example/");
    assert_eq!(warning.active_cap, 30);
    assert_eq!(warning.cap_source, RequestMessageSizeCapSource::Nip11);
    assert!(warning.estimated_bytes > warning.active_cap);
    Ok(())
}

#[test]
fn app_cap_still_applies_without_relay_cap() -> Result<(), String> {
    let decision = request_message_size_decision(
        "wss://relay.example/",
        "sub",
        &[NostrFilter {
            search: Some("x".repeat(app_max_req_message_bytes())),
            ..NostrFilter::default()
        }],
        None,
    )
    .map_err(|error| error.to_string())?;

    let RequestMessageSizeDecision::Reject(warning) = decision else {
        return Err("expected app cap rejection".to_owned());
    };
    assert_eq!(warning.active_cap, app_max_req_message_bytes());
    assert_eq!(warning.cap_source, RequestMessageSizeCapSource::App);
    Ok(())
}

#[test]
fn accepts_requests_under_active_cap() -> Result<(), String> {
    let decision = request_message_size_decision(
        "wss://relay.example/",
        "sub",
        &[NostrFilter {
            kinds: Some(vec![1]),
            ..NostrFilter::default()
        }],
        Some(1000),
    )
    .map_err(|error| error.to_string())?;

    assert!(matches!(
        decision,
        RequestMessageSizeDecision::Send { cap: 1000, .. }
    ));
    Ok(())
}
