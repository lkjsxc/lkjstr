#![allow(clippy::expect_used)]
// Native wire serialization, plus the actual core adapter for core-owned actions.
// The loopback witnesses compare these rows with the Worker at its transport boundary.
use lkjstr_core::engine::{
    Engine, protocol,
    signer_orchestration::SignerWork as Work,
    wire::{CryptContext, ExtensionCrypt, Output, Session},
};
use lkjstr_protocol::UnsignedNostrEvent;
use serde_json::{Value, json};

const NOW: u64 = 1_700_000_000_000;
const EXPIRY: u64 = NOW + 60_000;
fn unsigned(kind: u64) -> UnsignedNostrEvent {
    UnsignedNostrEvent {
        pubkey: "11".repeat(32),
        created_at: NOW / 1000,
        kind,
        tags: vec![],
        content: "synthetic signer fixture".into(),
    }
}
fn core_sign(req: &str, kind: u64, publish: bool) -> Output {
    Session::default()
        .output(
            protocol::Output::Sign {
                req: req.into(),
                event: unsigned(kind),
                publish,
                deadline: EXPIRY,
            },
            &Engine::new(),
        )
        .pop()
        .expect("core wire sign")
}
fn direct_sign(req: &str, action: Option<&str>, kind: u64, work: Work) -> Output {
    Output::extension_sign(req.into(), &unsigned(kind), action, work, EXPIRY)
}
fn crypt(req: &str, operation: &str, read: bool, passive: bool, list: bool) -> Output {
    ExtensionCrypt {
        account: &"11".repeat(32),
        peer: &if list { "11" } else { "22" }.repeat(32),
        operation,
        data: "synthetic ciphertext",
        read,
        passive,
        context: list.then(|| CryptContext::PrivateList {
            sub: "m".into(),
            event: "33".repeat(32),
        }),
    }
    .output(req.into(), EXPIRY)
}

fn row(lifecycle: &str, action: Option<&str>, message: Output) -> Value {
    let mut row = json!({"lifecycle": lifecycle, "message": message});
    if let Some(action) = action {
        row["action"] = json!(action);
    }
    row
}
fn fixture() -> Value {
    // The originating action is metadata, not a new wire field. In particular,
    // DM signing outlives the page action and does NOT carry actionReq.
    json!({
        "now": NOW,
        "rows": {
            "core-publish": row("action-by-req", Some("publish"), core_sign("publish", 1, true)),
            "core-action": row("action-by-req", Some("profile"), core_sign("profile", 0, false)),
            "discovery": row("action-by-req", Some("discover"), Output::GetPublicKey {
                req: "discover".into(), expires_at: EXPIRY,
            }),
            "upload": row("action-by-actionReq", Some("upload"), direct_sign("upload-auth-1-00000000000000000000000000000000", Some("upload"), 24242, Work::UserAction)),
            "upload-nip98": row("action-by-actionReq", Some("upload-nip98"), direct_sign("upload-auth-8-00000000000000000000000000000000", Some("upload-nip98"), 27235, Work::UserAction)),
            "zap": row("action-by-actionReq", Some("zap"), direct_sign("upload-auth-2-00000000000000000000000000000000", Some("zap"), 9734, Work::UserAction)),
            "auth-visible": row("worker-page", None, direct_sign("upload-auth-3-00000000000000000000000000000000", None, 22242, Work::Visible)),
            "auth-background": row("worker-page", None, direct_sign("upload-auth-4-00000000000000000000000000000000", None, 22242, Work::Background)),
            "auth-write": row("worker-page", None, direct_sign("upload-auth-5-00000000000000000000000000000000", None, 22242, Work::UserAction)),
            "dm-advertisement": row("worker-page", Some("dm-advertisement"), direct_sign("upload-auth-6-00000000000000000000000000000000", None, 10050, Work::UserAction)),
            "dm-seal": row("worker-page", Some("dm-send"), direct_sign("upload-auth-7-00000000000000000000000000000000", None, 13, Work::UserAction)),
            "dm-encrypt": row("private-write", Some("dm-send"), crypt("dm-crypto-00000000000000000000000000000001", "nip44.encrypt", false, false, false)),
            "dm-visible": row("private-read", None, crypt("dm-crypto-00000000000000000000000000000002", "nip44.decrypt", true, false, false)),
            "dm-background": row("private-read-background", None, crypt("dm-crypto-00000000000000000000000000000003", "nip44.decrypt", true, true, false)),
            "private-list": row("view-event", None, crypt("dm-crypto-00000000000000000000000000000004", "nip44.decrypt", false, false, true)),
            "upload-cancel": row("retire-by-req", Some("upload"), Output::SignCancel { req: "upload-auth-1-00000000000000000000000000000000".into() }),
            "dm-seal-cancel": row("retire-by-req", Some("dm-send"), Output::SignCancel { req: "upload-auth-7-00000000000000000000000000000000".into() }),
            "private-list-cancel": row("retire-by-req", None, Output::CryptCancel { req: "dm-crypto-00000000000000000000000000000004".into() }),
            "dm-read-cancel": row("retire-by-req", None, Output::CryptCancel { req: "dm-crypto-00000000000000000000000000000002".into() }),
        }
    })
}
#[test]
fn native_signer_ownership_matches_fixture() {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../web/tests/fixtures/native-signer-ownership.json"
    );
    let actual = fixture();
    // Deliberate regeneration only. Ordinary cargo test is read-only.
    if std::env::var_os("LKJSTR_UPDATE_SIGNER_OWNERSHIP").as_deref()
        == Some(std::ffi::OsStr::new("1"))
    {
        std::fs::write(
            path,
            format!("{}\n", serde_json::to_string_pretty(&actual).expect("JSON")),
        )
        .expect("write signer fixture");
    }
    let expected: Value = serde_json::from_str(&std::fs::read_to_string(path).expect("fixture"))
        .expect("fixture JSON");
    assert_eq!(actual, expected, "native signer ownership fixture changed");
    let mut mutant = expected;
    mutant["rows"]["dm-seal"]["message"]["actionReq"] = json!("dm-send");
    assert_ne!(
        actual, mutant,
        "historical mock ownership drift must be visible"
    );
}
