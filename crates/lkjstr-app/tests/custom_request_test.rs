use lkjstr_app::{
    CustomRequestErrorKind, CustomRequestMode, custom_request_mode, parse_custom_request,
};
use lkjstr_protocol::KIND_TEXT_NOTE;
use serde_json::json;

#[test]
fn custom_request_parses_request_object_and_clamps_limit() -> Result<(), String> {
    let request = parse_custom_request(
        r#"{"filter":{"kinds":[1],"limit":999},"relays":["https://b.example","wss://a.example"]}"#,
    )
    .map_err(|error| format!("{error:?}"))?;
    let [filter] = request.filters.as_slice() else {
        return Err("wanted one filter".to_owned());
    };

    assert_eq!(filter.kinds, Some(vec![KIND_TEXT_NOTE]));
    assert_eq!(filter.limit, Some(500));
    assert_eq!(request.limit_clamps.len(), 1);
    assert_eq!(request.limit_clamps[0].filter_index, 0);
    assert_eq!(request.limit_clamps[0].original_limit, 999);
    assert_eq!(request.limit_clamps[0].effective_limit, 500);
    assert_eq!(
        request.relays,
        vec!["wss://a.example/".to_owned(), "wss://b.example/".to_owned()]
    );
    Ok(())
}

#[test]
fn custom_request_parses_req_shape_and_classifies_exact_ids() -> Result<(), String> {
    let raw = json!(["REQ", "sub-a", {"ids": [hex("a")]}]).to_string();
    let request = parse_custom_request(&raw).map_err(|error| format!("{error:?}"))?;

    assert_eq!(request.sub_id.as_deref(), Some("sub-a"));
    assert_eq!(
        custom_request_mode(&request.filters),
        CustomRequestMode::Exact
    );
    Ok(())
}

#[test]
fn custom_request_classifies_search_filters_as_exact() -> Result<(), String> {
    let request = parse_custom_request(r#"{"search":"nostr wasm","kinds":[1],"limit":20}"#)
        .map_err(|error| format!("{error:?}"))?;

    assert_eq!(
        custom_request_mode(&request.filters),
        CustomRequestMode::Exact
    );
    Ok(())
}

#[test]
fn custom_request_classifies_plain_event_filters_as_adaptive() -> Result<(), String> {
    let request = parse_custom_request(r#"[{"kinds":[1],"since":10,"until":20}]"#)
        .map_err(|error| format!("{error:?}"))?;

    assert_eq!(
        custom_request_mode(&request.filters),
        CustomRequestMode::AdaptiveFeed
    );
    Ok(())
}

#[test]
fn custom_request_rejects_too_many_filters() {
    let raw = json!((0..9).map(|_| json!({"kinds": [1]})).collect::<Vec<_>>()).to_string();
    let error = parse_custom_request(&raw).err().map(|error| error.kind);

    assert_eq!(error, Some(CustomRequestErrorKind::TooManyFilters));
}

#[test]
fn custom_request_rejects_too_many_id_values() {
    let ids = (0..501)
        .map(|index| format!("{:064x}", index))
        .collect::<Vec<_>>();
    let raw = json!({"ids": ids}).to_string();
    let error = parse_custom_request(&raw).err().map(|error| error.kind);

    assert_eq!(error, Some(CustomRequestErrorKind::TooManyIds));
}

#[test]
fn custom_request_rejects_too_many_author_values() {
    let raw = json!({"authors": many_hex(501)}).to_string();
    let error = parse_custom_request(&raw).err().map(|error| error.kind);

    assert_eq!(error, Some(CustomRequestErrorKind::TooManyAuthors));
}

#[test]
fn custom_request_rejects_too_many_tag_values() {
    let raw = json!({"#e": many_hex(501)}).to_string();
    let error = parse_custom_request(&raw).err().map(|error| error.kind);

    assert_eq!(error, Some(CustomRequestErrorKind::TooManyTagValues));
}

#[test]
fn custom_request_rejects_search_above_byte_cap() {
    let raw = json!({"search": "x".repeat(257)}).to_string();
    let error = parse_custom_request(&raw).err().map(|error| error.kind);

    assert_eq!(error, Some(CustomRequestErrorKind::SearchTooLarge));
}

#[test]
fn custom_request_rejects_json_above_byte_cap_before_parsing() {
    let raw = " ".repeat(64 * 1024 + 1);
    let error = parse_custom_request(&raw).err().map(|error| error.kind);

    assert_eq!(error, Some(CustomRequestErrorKind::JsonTooLarge));
}

#[test]
fn custom_request_rejects_too_many_explicit_relays() {
    let relays = (0..33)
        .map(|index| format!("wss://relay-{index}.example"))
        .collect::<Vec<_>>();
    let raw = json!({"filter":{"kinds":[1]},"relays":relays}).to_string();
    let error = parse_custom_request(&raw).err().map(|error| error.kind);

    assert_eq!(error, Some(CustomRequestErrorKind::TooManyRelays));
}

#[test]
fn custom_request_rejects_invalid_explicit_relay_url() {
    let raw = json!({"filter":{"kinds":[1]},"relays":["not a relay"]}).to_string();
    let error = parse_custom_request(&raw).err().map(|error| error.kind);

    assert_eq!(error, Some(CustomRequestErrorKind::InvalidRelayUrl));
}

fn many_hex(count: usize) -> Vec<String> {
    (0..count).map(|index| format!("{:064x}", index)).collect()
}

fn hex(value: &str) -> String {
    value.repeat(64)
}
