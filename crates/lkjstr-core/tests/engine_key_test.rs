#![allow(clippy::expect_used, clippy::panic)]
use lkjstr_core::engine::{
    accounts::Accounts,
    wire::{Input, Output, Session},
};
use lkjstr_protocol as p;
use serde_json::json;
#[test]
fn backup_is_explicit_and_debug_never_discloses_secrets() {
    let mut accounts = Accounts::default();
    accounts.add("create", None).expect("create");
    let pubkey = accounts.active.clone().expect("active");
    let secret = accounts.backup_key(&pubkey).expect("backup");
    let Some(p::NostrEntity::Nsec(hex)) = p::decode_nip19(&secret) else {
        panic!("nsec")
    };
    assert_eq!(p::public_key_from_secret_hex(&hex).expect("public"), pubkey);
    let input: Input = serde_json::from_value(
        json!({"t":"act","req":"import","action":{"a":"account.add","how":"key","key":secret}}),
    )
    .expect("input");
    let output = Output::Result {
        req: "backup".into(),
        ok: true,
        error: None,
        delivery: None,
        id: None,
        uploaded: None,
        key: Some(secret.clone()),
        encrypted_key: None,
        cancelled: None,
    };
    let diagnostics = format!(
        "{input:?} {output:?} {:?}",
        Session::failure("bad".into(), "unsupported")
    );
    assert!(!diagnostics.contains(&secret));
    assert!(!diagnostics.contains(&hex));
    let result = serde_json::to_value(output).expect("result");
    assert!(
        result["key"].as_str() == Some(secret.as_str()),
        "explicit backup must match"
    );
    assert!(
        serde_json::to_value(Session::failure("bad".into(), "unsupported"))
            .expect("failure")
            .get("key")
            .is_none()
    );
    let mut engine = lkjstr_core::engine::Engine::new();
    let mut session = Session::default();
    for input in session
        .input(
            serde_json::from_value(
                json!({"t":"open","sub":"diag","query":{"source":"diagnostics"}}),
            )
            .expect("diagnostics"),
            &engine,
        )
        .expect("supported")
    {
        engine.input(input, 0);
    }
    for message in engine
        .drain()
        .into_iter()
        .flat_map(|o| session.output(o, &engine))
    {
        let telemetry = serde_json::to_string(&message).expect("telemetry");
        assert!(!telemetry.contains(&secret));
        assert!(!telemetry.contains(&hex));
    }
    let mut readonly = Accounts::default();
    readonly
        .add("key", Some(&p::encode_npub(&pubkey).expect("npub")))
        .expect("reader");
    assert!(matches!(readonly.backup_key(&pubkey), Err("unsupported")));
    readonly.add("extension", Some(&pubkey)).expect("extension");
    assert!(matches!(readonly.backup_key(&pubkey), Err("unsupported")));
    assert!(matches!(readonly.backup_key("unknown"), Err("not-found")));
}
