use serde_json::json;

use lkjstr_protocol::{
    BlossomAuthInput, blossom_upload_auth_event, blossom_upload_endpoint,
    parse_blossom_blob_descriptor_value,
};

#[test]
fn resolves_blossom_upload_endpoints() {
    assert_eq!(
        blossom_upload_endpoint("https://media.example").as_deref(),
        Some("https://media.example/upload")
    );
    assert_eq!(
        blossom_upload_endpoint("https://media.example/custom").as_deref(),
        Some("https://media.example/custom")
    );
    assert_eq!(blossom_upload_endpoint("http://media.example"), None);
}

#[test]
fn builds_blossom_upload_auth_events() {
    let event = blossom_upload_auth_event(BlossomAuthInput {
        pubkey: "a".repeat(64),
        endpoint: "https://media.example/upload".to_owned(),
        sha256: "b".repeat(64),
        size: 42,
        created_at: 100,
        expiration: 160,
    });
    assert_eq!(event.kind, 24_242);
    assert!(
        event
            .tags
            .contains(&vec!["t".to_owned(), "upload".to_owned()])
    );
    assert!(
        event
            .tags
            .contains(&vec!["method".to_owned(), "PUT".to_owned()])
    );
    assert!(
        event
            .tags
            .contains(&vec!["size".to_owned(), "42".to_owned()])
    );
}

#[test]
fn parses_blossom_blob_descriptors() {
    let hash = "c".repeat(64);
    let descriptor = parse_blossom_blob_descriptor_value(
        &json!({
            "url": "https://media.example/blob.png",
            "sha256": hash,
            "size": 9,
            "type": "image/png"
        }),
        &hash,
        "https://media.example/fallback",
        None,
        None,
    );
    let Some(descriptor) = descriptor else {
        unreachable!("descriptor missing");
    };
    assert_eq!(descriptor.url, "https://media.example/blob.png");
    assert_eq!(descriptor.tags[1], vec!["x".to_owned(), hash]);
    assert_eq!(descriptor.imeta[2], "m image/png");
}

#[test]
fn rejects_mismatched_blossom_hashes() {
    assert!(
        parse_blossom_blob_descriptor_value(
            &json!({"url": "https://media.example/blob.png", "sha256": "d".repeat(64)}),
            &"e".repeat(64),
            "https://media.example/fallback",
            None,
            None,
        )
        .is_none()
    );
}
