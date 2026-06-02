use lkjstr_app::{
    CustomRequestErrorKind, CustomRequestMode, custom_request_mode, parse_custom_request,
};
use lkjstr_protocol::KIND_TEXT_NOTE;
use serde_json::json;

#[test]
fn parses_request_object_and_clamps_limit() -> Result<(), String> {
    let request = parse_custom_request(
        r#"{"filter":{"kinds":[1],"limit":999},"relays":["https://b.example","wss://a.example"]}"#,
    )
    .map_err(|error| format!("{error:?}"))?;
    let [filter] = request.filters.as_slice() else {
        return Err("wanted one filter".to_owned());
    };

    assert_eq!(filter.kinds, Some(vec![KIND_TEXT_NOTE]));
    assert_eq!(filter.limit, Some(500));
    assert_eq!(
        request.relays,
        vec!["wss://a.example/".to_owned(), "wss://b.example/".to_owned()]
    );
    Ok(())
}

#[test]
fn parses_req_shape_and_classifies_exact_ids() -> Result<(), String> {
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
fn classifies_plain_event_filters_as_adaptive() -> Result<(), String> {
    let request = parse_custom_request(r#"[{"kinds":[1],"since":10,"until":20}]"#)
        .map_err(|error| format!("{error:?}"))?;

    assert_eq!(
        custom_request_mode(&request.filters),
        CustomRequestMode::AdaptiveFeed
    );
    Ok(())
}

#[test]
fn rejects_too_many_filters() {
    let raw = json!((0..9).map(|_| json!({"kinds": [1]})).collect::<Vec<_>>()).to_string();
    let error = parse_custom_request(&raw).err().map(|error| error.kind);

    assert_eq!(error, Some(CustomRequestErrorKind::TooManyFilters));
}

#[test]
fn rejects_too_many_id_values() {
    let ids = (0..501)
        .map(|index| format!("{:064x}", index))
        .collect::<Vec<_>>();
    let raw = json!({"ids": ids}).to_string();
    let error = parse_custom_request(&raw).err().map(|error| error.kind);

    assert_eq!(error, Some(CustomRequestErrorKind::TooManyIds));
}

fn hex(value: &str) -> String {
    value.repeat(64)
}
