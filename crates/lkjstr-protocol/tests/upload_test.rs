#![allow(clippy::unwrap_used)]
use base64::{Engine as _, engine::general_purpose::STANDARD};
use lkjstr_protocol::{
    EventTemplate, blossom_upload_endpoint, finalize_event, generate_secret_key, upload,
};
use serde_json::json;
#[test]
fn blossom_request_and_authorization_bind_the_file() {
    let hash = upload::hash(b"PNG fixture");
    let event = upload::auth(
        "a".repeat(64),
        100,
        "https://blossom.band/upload",
        &hash,
        true,
    );
    assert_eq!(event.kind, 24242);
    assert_eq!(upload::method(true), "PUT");
    assert_eq!(
        blossom_upload_endpoint("https://blossom.band/"),
        Some("https://blossom.band/upload".into())
    );
    assert_eq!(
        blossom_upload_endpoint("https://host.test/upload"),
        Some("https://host.test/upload".into())
    );
    assert_eq!(
        event.tags,
        vec![
            vec!["t", "upload"],
            vec!["x", &hash],
            vec!["expiration", "400"]
        ]
    );
}
#[test]
fn nip96_uses_nip98_for_the_exact_discovered_endpoint() {
    let url = "https://nostr.build/api/v2/nip96/upload?plan=free";
    let event = upload::auth("a".repeat(64), 100, url, &upload::hash(b"file"), false);
    assert_eq!(event.kind, 27235);
    assert_eq!(upload::method(false), "POST");
    assert!(event.content.is_empty());
    assert_eq!(event.tags, vec![vec!["u", url], vec!["method", "POST"]]);
    // The multipart boundary is browser-owned; never claim its hash is the file hash.
    assert!(!event.tags.iter().any(|t| t[0] == "payload"));
}
#[test]
fn authorization_is_base64_of_the_signed_event() {
    let secret = generate_secret_key();
    let event = finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 100,
            kind: 24242,
            tags: vec![vec!["t".into(), "upload".into()]],
            content: "Upload file".into(),
        },
        &secret,
    )
    .unwrap();
    let header = upload::authorization(&event).unwrap();
    let value: serde_json::Value = serde_json::from_slice(
        &STANDARD
            .decode(header.strip_prefix("Nostr ").unwrap())
            .unwrap(),
    )
    .unwrap();
    assert_eq!(value, serde_json::to_value(event).unwrap());
}
#[test]
fn responses_accept_both_protocols_but_reject_mismatched_or_unsafe_metadata() {
    let hash = upload::hash(b"fixture");
    let blossom = json!({"url":"https://cdn.test/file.png","sha256":hash,"type":"image/png"});
    assert!(upload::uploaded(&blossom.to_string(), "image/png", &hash, true).is_some());
    assert!(upload::uploaded(&blossom.to_string(), "image/png", &"b".repeat(64), true).is_none());
    let nip96 = json!({"status":"success","nip94_event":{"tags":[["url","https://cdn.test/file.webp"],["ox",hash],["x","c".repeat(64)],["m","image/webp"]]}});
    let result = upload::uploaded(&nip96.to_string(), "image/png", &hash, false).unwrap();
    assert_eq!(result["sha256"], "c".repeat(64));
    assert_eq!(result["mime"], "image/webp");
    for url in [
        "javascript:alert(1)",
        "http://cdn.test/file.png",
        "https://user:pass@cdn.test/file.png",
    ] {
        assert!(
            upload::uploaded(
                &json!({"url":url,"sha256":hash}).to_string(),
                "image/png",
                &hash,
                true
            )
            .is_none()
        );
    }
    for body in [
        "not json",
        r#"{"status":"processing"}"#,
        r#"{"status":"success","nip94_event":{"tags":[[],["url"]]}}"#,
    ] {
        assert!(upload::uploaded(body, "image/png", &hash, false).is_none());
    }
}
