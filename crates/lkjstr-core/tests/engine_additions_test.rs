#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{
    Engine, settings,
    wire::{RelayConfig, Session},
};
use serde_json::{Value, json};
#[test]
fn configure_retains_unused_urls_and_validates_atomically() {
    let mut e = Engine::new();
    let relay = |read, write, search| RelayConfig {
        url: RELAY.into(),
        read,
        write,
        search,
    };
    e.configure_relays(vec![relay(true, false, true)], 0)
        .expect("configure");
    assert_eq!(e.relay_rows()[0]["write"], false);
    assert!(
        e.configure_relays(
            vec![RelayConfig {
                url: "https://bad.test".into(),
                ..relay(true, true, true)
            }],
            0
        )
        .is_err()
    );
    assert_eq!(e.relay_rows()[0]["read"], true);
    e.configure_relays(vec![], 1).expect("clear");
    assert_eq!(e.relay_rows()[0]["why"], "unused");
    assert!(e.network.relays.is_empty());
    for url in [
        "https://x.test",
        "wss://u:p@x.test",
        "wss://x.test/#fragment",
        "wss://x.test/?query=1",
    ] {
        assert!(settings::strict_relay(url).is_none());
    }
}
#[test]
fn relay_addresses_bound_raw_and_normalized_bytes() {
    let prefix = "wss://x.test/";
    let boundary = format!("{prefix}{}", "a".repeat(2048 - prefix.len()));
    assert!(settings::strict_relay(&boundary).is_some());
    assert!(settings::strict_relay(&format!("{boundary}a")).is_none());
    // URL normalization percent-encodes non-ASCII paths and can expand bytes.
    let expanded = format!("{prefix}{}", "é".repeat(500));
    assert!(expanded.len() < 2048);
    assert!(settings::strict_relay(&expanded).is_none());
}
#[test]
fn server_save_rejects_bad_addresses_before_signing() {
    let mut s = Session::default();
    let mut e = Engine::new();
    for url in [
        "http://bad.test",
        "https://u:p@bad.test",
        "https://bad.test/#fragment",
    ] {
        accept(
            &mut s,
            &mut e,
            json!({"t":"act","req":"s","action":{"a":"servers.save","as":"a".repeat(64),"servers":[url]}}),
            0,
        );
        assert_eq!(output(&mut s, &mut e)[0]["error"]["code"], "rejected");
    }
}
#[test]
fn device_accounts_roundtrip_sign_and_remove_without_public_secret() {
    let mut accounts = lkjstr_core::engine::accounts::Accounts::default();
    accounts.add("create", None).expect("create");
    let pubkey = accounts.active.clone().expect("active");
    let private = serde_json::to_string(&accounts).expect("private storage");
    let mut restored: lkjstr_core::engine::accounts::Accounts =
        serde_json::from_str(&private).expect("restore");
    let event = restored
        .sign(&lkjstr_protocol::UnsignedNostrEvent {
            pubkey: pubkey.clone(),
            created_at: 1,
            kind: 1,
            tags: vec![],
            content: "test".into(),
        })
        .expect("sign")
        .expect("local");
    assert!(matches!(
        lkjstr_protocol::verify_event(&event),
        lkjstr_protocol::VerificationResult::Ok(_)
    ));
    restored.remove(&pubkey).expect("remove");
    assert!(restored.entries.is_empty());
    assert!(restored.active.is_none());
}
#[test]
fn notifications_group_reactions_and_seen_watermarks() {
    let mut e = Engine::new();
    let mut s = Session::default();
    let account = "a".repeat(64);
    let target = "b".repeat(64);
    for at in 1..=3 {
        e.store.insert(
            event(
                at,
                7,
                "+",
                vec![
                    vec!["p".into(), account.clone()],
                    vec!["e".into(), target.clone()],
                ],
            ),
            None,
        );
    }
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"n","query":{"source":"notifications","account":account}}),
        0,
    );
    let rows = output(&mut s, &mut e);
    let row = &rows.iter().find(|v| v["t"] == "rows").expect("rows")["rows"][0];
    assert_eq!(row["actors"].as_array().expect("actors").len(), 3);
    assert_eq!(row["unread"], true);
    e.seen.insert(account.clone(), 3000);
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"n","anchor":"top","before":0,"after":20}),
        1,
    );
    let rows = output(&mut s, &mut e);
    let row = &rows.iter().find(|v| v["t"] == "rows").expect("rows")["rows"][0];
    assert_eq!(row["unread"], false);
}
#[test]
fn addressable_people_list_uses_address_author_and_identifier() {
    let mut e = Engine::new();
    let mut s = Session::default();
    let list = event(
        1,
        30000,
        "",
        vec![
            vec!["d".into(), "friends".into()],
            vec!["p".into(), "a".repeat(64)],
        ],
    );
    let address = format!("30000:{}:friends", list.pubkey);
    e.store.insert(list, None);
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"list","query":{"source":"list","id":address}}),
        0,
    );
    let rows = output(&mut s, &mut e);
    let row = &rows.iter().find(|v| v["t"] == "rows").expect("rows")["rows"][0];
    assert_eq!(row["kind"], "person");
    assert_eq!(row["author"]["pubkey"], "a".repeat(64));
}
#[test]
fn failure_codes_stay_in_frontend_union() {
    for (internal, expected) in [
        ("invalid-relay", "rejected"),
        ("invalid-server", "rejected"),
        ("read-only", "read-only"),
        ("list-not-loaded", "not-found"),
    ] {
        let v: Value =
            serde_json::to_value(Session::failure("r".into(), internal)).expect("failure");
        assert_eq!(v["error"]["code"], expected);
    }
}
