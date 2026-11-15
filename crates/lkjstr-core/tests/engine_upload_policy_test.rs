use lkjstr_core::engine::{Engine, feedback::ServerEvidence};
#[test]
fn default_media_destinations_match_the_browser_verified_choices() {
    let mut engine = Engine::new();
    assert_eq!(
        engine.upload_servers(&"a".repeat(64)),
        vec![
            "https://blossom.band",
            "https://blossom.primal.net",
            "https://nostr.build",
            "https://nostrcheck.me",
        ]
    );
    assert!(!engine.upload_is_nip96("https://blossom.band"));
    assert!(engine.upload_is_nip96("https://nostr.build"));
    assert!(engine.upload_is_nip96("https://nostr.build/"));
    engine.observe_server(
        "https://custom.test",
        "nip96",
        ServerEvidence::Required(Ok(())),
    );
    assert!(engine.upload_is_nip96("https://custom.test"));
}

#[test]
fn only_fresh_required_http_failure_marks_down_and_success_recovers() {
    let mut e = Engine::new();
    let url = "https://blossom.band";
    assert_eq!(e.server_row(url)["checked"], false);
    assert_eq!(e.server_row(url)["protocol"], "blossom");
    e.observe_server(url, "blossom", ServerEvidence::Optional(false));
    assert_eq!(e.server_row(url)["checked"], false);
    e.observe_server(
        url,
        "blossom",
        ServerEvidence::Required(Err("upload-network")),
    );
    assert_eq!(e.server_row(url)["checked"], true);
    assert_eq!(e.server_row(url)["ok"], false);
    assert_eq!(e.server_row(url)["error"]["code"], "upload-network");
    e.observe_server(url, "blossom", ServerEvidence::Checking);
    assert_eq!(e.server_row(url)["checked"], false);
    e.observe_server(url, "blossom", ServerEvidence::Required(Ok(())));
    assert_eq!(e.server_row(url)["ok"], true);
    assert!(e.server_row(url).get("error").is_none());
    // A new page/Worker never inherits reachability, including a former failure.
    assert_eq!(Engine::new().server_row(url)["checked"], false);
}
#[test]
fn selection_uses_the_same_live_evidence_as_the_rows_in_list_order() {
    let mut e = Engine::new();
    let a = "a".repeat(64);
    e.observe_server(
        "https://blossom.band",
        "blossom",
        ServerEvidence::Required(Err("upload-timeout")),
    );
    assert_eq!(e.upload_candidates(&a)[0], "https://blossom.primal.net");
    e.observe_server(
        "https://blossom.band",
        "blossom",
        ServerEvidence::Optional(false),
    );
    assert_eq!(e.upload_candidates(&a)[0], "https://blossom.band");
    e.observe_server(
        "https://blossom.band",
        "blossom",
        ServerEvidence::Optional(true),
    );
    assert_eq!(e.server_row("https://blossom.band")["ok"], true);
    assert_eq!(e.upload_candidates(&a)[0], "https://blossom.band");
}
