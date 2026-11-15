#![allow(clippy::expect_used)]
use lkjstr_protocol as p;
#[test]
fn compact_storage_reads_legacy_and_versioned_events() {
    let key = p::generate_secret_key();
    let event = p::finalize_event(
        &p::EventTemplate {
            pubkey: None,
            created_at: 1,
            kind: 1,
            tags: vec![],
            content: "fixture".into(),
        },
        &key,
    )
    .expect("event");
    let legacy = serde_json::to_string(&event).expect("legacy");
    let compact = p::compact::encode(&event).expect("encode");
    assert!(compact.len() < legacy.len());
    assert_eq!(p::compact::decode(&compact).expect("compact"), event);
    assert_eq!(p::compact::decode(&legacy).expect("legacy"), event);
    assert!(p::compact::decode(&compact.replacen("[1,", "[2,", 1)).is_err());
}
#[test]
fn upload_metadata_rejects_wrong_hash_and_non_https_url() {
    let hash = p::upload::hash(b"test");
    let valid =
        serde_json::json!({"url":"https://media.test/a.png","sha256":hash,"type":"image/png"});
    assert!(p::upload::uploaded(&valid.to_string(), "image/png", &hash, true).is_some());
    assert!(p::upload::uploaded(&valid.to_string(), "image/png", "wrong", true).is_none());
    let mut bad = valid;
    bad["url"] = serde_json::json!("javascript:alert(1)");
    assert!(p::upload::uploaded(&bad.to_string(), "image/png", &hash, true).is_none());
}
#[test]
fn remote_session_rejects_bad_peer_and_has_correlated_signed_requests() {
    assert!(p::remote::Remote::parse("bunker://bad?relay=wss://relay.test").is_none());
    let peer = p::public_key_from_secret(&p::generate_secret_key()).expect("public key");
    let (session, _) = p::remote::Remote::parse(&format!("bunker://{peer}?relay=wss://relay.test"))
        .expect("session");
    let request = session
        .request("id", "get_public_key", vec![], 1)
        .expect("request");
    assert_eq!(request.kind, 24133);
    assert!(matches!(
        p::verify_event(&request),
        p::VerificationResult::Ok(_)
    ));
    assert!(session.response(&request, "id").is_none());
}
