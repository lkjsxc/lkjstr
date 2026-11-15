#![allow(clippy::expect_used)]
mod engine_review_support;
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
    assert_eq!(
        e.upload_candidates(&a).expect("candidates")[0],
        "https://blossom.primal.net"
    );
    e.observe_server(
        "https://blossom.band",
        "blossom",
        ServerEvidence::Optional(false),
    );
    assert_eq!(
        e.upload_candidates(&a).expect("candidates")[0],
        "https://blossom.band"
    );
    e.observe_server(
        "https://blossom.band",
        "blossom",
        ServerEvidence::Optional(true),
    );
    assert_eq!(e.server_row("https://blossom.band")["ok"], true);
    assert_eq!(
        e.upload_candidates(&a).expect("candidates")[0],
        "https://blossom.band"
    );
}

#[test]
fn failed_discovery_preserves_protocol_until_successful_discovery() {
    let mut e = Engine::new();
    let url = "https://custom.test";
    e.observe_server(
        url,
        "nip96",
        ServerEvidence::Required(Err("upload-discovery")),
    );
    assert_eq!(e.server_row(url)["protocol"], "unknown");
    assert!(!e.upload_is_nip96(url));
    e.observe_server(url, "blossom", ServerEvidence::Required(Ok(())));
    e.observe_server(
        url,
        "nip96",
        ServerEvidence::Required(Err("upload-discovery")),
    );
    assert_eq!(e.server_row(url)["protocol"], "blossom");
    assert!(!e.upload_is_nip96(url));
    assert_eq!(e.server_row(url)["error"]["code"], "upload-discovery");
    e.observe_server(url, "nip96", ServerEvidence::Required(Ok(())));
    assert!(e.upload_is_nip96(url));
    e.observe_server(
        url,
        "blossom",
        ServerEvidence::Required(Err("upload-network")),
    );
    assert!(e.upload_is_nip96(url));
}
#[test]
fn all_failed_destinations_keep_the_first_failure_and_empty_lists_remain_empty() {
    let mut e = Engine::new();
    let account = "a".repeat(64);
    for url in e.upload_servers(&account) {
        e.observe_server(
            &url,
            "blossom",
            ServerEvidence::Required(Err("upload-timeout")),
        );
    }
    let failure = e.upload_candidates(&account).expect_err("unavailable");
    assert_eq!(failure.server.as_deref(), Some("https://blossom.band"));
    assert_eq!(failure.code, "upload-timeout");
    let empty = engine_review_support::event(1, 10063, "", vec![]);
    let owner = empty.pubkey.clone();
    e.store.insert(empty, None);
    let empty = e.upload_candidates(&owner).expect_err("unavailable");
    assert_eq!(empty.server, None);
    assert_eq!(empty.code, "not-found");
    e.observe_server(
        "https://blossom.band",
        "blossom",
        ServerEvidence::Optional(true),
    );
    assert_eq!(
        e.upload_candidates(&account).expect("candidates"),
        vec!["https://blossom.band"]
    );
}
#[test]
fn every_upload_stage_and_destination_spends_one_deadline() {
    use lkjstr_core::engine::upload::{Deadline, UPLOAD_BUDGET_MS};
    let start = 17_000;
    let deadline = Deadline::new(start);
    let mut time = start;
    // Discovery + two signers + delegated discovery + processing, then fallback.
    for cap in [
        15_000, 60_000, 30_000, 30_000, 30_000, 60_000, 30_000, 1_000, 30_000,
    ] {
        let ms = deadline.wait(time, cap).expect("budget");
        assert!(ms <= cap);
        time += u64::from(ms);
    }
    assert_eq!(time - start, UPLOAD_BUDGET_MS);
    assert!(time - start < 300_000);
    assert_eq!(deadline.wait(time, 60_000), Err("upload-timeout"));
    assert_eq!(deadline.wait(time + 1, 30_000), Err("upload-timeout"));
    // Ten slow destinations cannot consume ten independent 30-second budgets.
    let waits: Vec<_> = (0..10)
        .map(|n| deadline.wait(start + n * 30_000, 30_000))
        .collect();
    assert_eq!(waits[8], Ok(30_000));
    assert_eq!(waits[9], Ok(15_000));
}
#[test]
fn concurrent_verdicts_cannot_turn_signer_failures_into_fallback() {
    use lkjstr_core::engine::upload::AttemptFailure;
    let mut e = Engine::new();
    let url = "https://blossom.band";
    let signer: AttemptFailure = "signer-refused".into();
    e.observe_server(
        url,
        "blossom",
        ServerEvidence::Required(Err("upload-network")),
    );
    assert!(!signer.fallback);
    assert!(!AttemptFailure::from("signer-missing").fallback);
    assert!(AttemptFailure::required("upload-network").fallback);
    e.observe_server(url, "blossom", ServerEvidence::Required(Ok(())));
    assert!(AttemptFailure::required("upload-timeout").fallback);
}
