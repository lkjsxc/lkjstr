use lkjstr_protocol::{
    Nip96Server, Nip96UploadResult, nip96_discovery_url, parse_nip96_server_value,
    parse_nip96_upload_result_value, valid_https_url,
};
use serde_json::json;

#[test]
fn builds_https_discovery_urls() {
    assert_eq!(
        nip96_discovery_url("https://media.example/upload"),
        Some("https://media.example/.well-known/nostr/nip96.json".to_owned())
    );
    assert!(nip96_discovery_url("http://media.example").is_none());
    assert!(valid_https_url("https://media.example").is_some());
}

#[test]
fn parses_server_documents() {
    assert_eq!(
        parse_nip96_server_value(&json!({ "api_url": "https://media.example/api" })),
        Some(Nip96Server {
            api_url: Some("https://media.example/api".to_owned()),
            delegated_to_url: None,
        })
    );
    assert_eq!(
        parse_nip96_server_value(&json!({ "url": "https://media.example/fallback" }))
            .and_then(|server| server.api_url),
        Some("https://media.example/fallback".to_owned())
    );
    assert!(parse_nip96_server_value(&json!({ "api_url": "" })).is_none());
}

#[test]
fn parses_upload_results_and_imeta_tags() {
    assert_eq!(
        parse_nip96_upload_result_value(&json!({
            "nip94_event": {
                "tags": [
                    ["url", "https://cdn.example/a.png"],
                    ["m", "image/png"],
                    ["dim", "10x10"],
                    ["bad", 1]
                ]
            }
        })),
        Some(Nip96UploadResult {
            url: "https://cdn.example/a.png".to_owned(),
            tags: vec![
                vec!["url".to_owned(), "https://cdn.example/a.png".to_owned()],
                vec!["m".to_owned(), "image/png".to_owned()],
                vec!["dim".to_owned(), "10x10".to_owned()],
            ],
            imeta: vec![
                "imeta".to_owned(),
                "url https://cdn.example/a.png".to_owned(),
                "m image/png".to_owned(),
                "dim 10x10".to_owned(),
            ],
        })
    );
}

#[test]
fn falls_back_to_top_level_upload_fields() {
    assert_eq!(
        parse_nip96_upload_result_value(&json!({
            "url": "https://cdn.example/top.png",
            "tags": [["m", "image/png"]]
        }))
        .map(|result| result.imeta),
        Some(vec![
            "imeta".to_owned(),
            "url https://cdn.example/top.png".to_owned(),
            "m image/png".to_owned(),
        ])
    );
    assert!(parse_nip96_upload_result_value(&json!({ "tags": [] })).is_none());
}
