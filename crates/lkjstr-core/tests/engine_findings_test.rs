#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{
    Engine,
    accounts::Accounts,
    network::Effect,
    protocol::{Action, Input, Output, Query, Source},
    wire::RelayConfig,
};
use lkjstr_protocol as p;
use serde_json::json;

#[test]
fn first_lists_require_successful_untruncated_owner_lookup() {
    for response in ["EOSE", "CLOSED", "pending", "full", "verifying", "metadata"] {
        let mut accounts = Accounts::default();
        accounts.add("create", None).expect("create");
        let key = accounts.active.clone().expect("active");
        let mut e = Engine::new();
        e.input(
            Input::Configure {
                relays: vec![RELAY.into()],
            },
            0,
        );
        open(
            &mut e,
            Query {
                account: Some(key.clone()),
                ..Default::default()
            },
        );
        e.network.connected(RELAY, 1);
        let req = frames(&mut e)
            .into_iter()
            .find(|f| f[0] == "REQ" && f[2]["authors"] == json!([key]))
            .expect("owner lookup");
        if matches!(response, "full" | "metadata") {
            for at in 0..if response == "full" { 7 } else { 1 } {
                let event = accounts
                    .sign(&p::UnsignedNostrEvent {
                        pubkey: key.clone(),
                        kind: 0,
                        created_at: at,
                        tags: vec![],
                        content: "{}".into(),
                    })
                    .expect("sign")
                    .expect("local");
                e.network
                    .message(RELAY, &json!(["EVENT", req[1], event]).to_string(), 2);
                e.store.insert(event, None);
            }
        }
        if response != "pending" {
            let frame = if response == "CLOSED" {
                json!(["CLOSED", req[1], "blocked"])
            } else {
                json!(["EOSE", req[1]])
            };
            e.network.message(RELAY, &frame.to_string(), 3);
        }
        e.network.verifying = response == "verifying";
        e.drain();
        for action in [
            Action::Follow {
                pubkey: "a".repeat(64),
                value: true,
            },
            Action::Mute {
                kind: "person".into(),
                target: "a".repeat(64),
                value: true,
            },
            Action::Bookmark {
                id: "b".repeat(64),
                value: true,
            },
        ] {
            e.input(
                Input::Action {
                    req: format!("{action:?}"),
                    account: key.clone(),
                    action,
                },
                4,
            );
            let out = e.drain();
            assert_eq!(
                out.iter().any(|o| matches!(o, Output::Sign { .. })),
                matches!(response, "EOSE" | "metadata"),
                "{response}"
            );
            if !matches!(response, "EOSE" | "metadata") {
                assert!(
                    out.iter()
                        .any(|o| matches!(o,Output::Error{code,..} if code=="list-not-loaded"))
                );
            }
        }
    }
}

#[test]
fn search_uses_two_best_eligible_relays() {
    let mut e = Engine::new();
    let configs: Vec<_> = (0..6)
        .map(|i| RelayConfig {
            url: format!("wss://r{i}.test/"),
            read: i != 2,
            write: true,
            search: i >= 2,
        })
        .collect();
    e.configure_relays(configs.clone(), 0).expect("configure");
    let q = Query {
        source: Source::Search,
        target: Some("hello".into()),
        ..Default::default()
    };
    open(&mut e, q);
    e.network.drain_effects();
    for c in &configs {
        e.network.connected(&c.url, 1);
    }
    let routes: Vec<_> = e
        .network
        .drain_effects()
        .into_iter()
        .filter_map(|f| match f {
            Effect::Send(url, s) if s.contains("\"search\":\"hello\"") => Some(url),
            _ => None,
        })
        .collect();
    assert_eq!(routes, vec![configs[3].url.clone(), configs[4].url.clone()]);
}

#[test]
fn signer_replacement_drops_bunker_credentials_and_survives_restore() {
    let secret = p::generate_secret_key();
    let key = p::public_key_from_secret(&secret).expect("pubkey");
    let nsec = p::encode_nsec(&p::bytes_to_hex(secret.as_bytes())).expect("nsec");
    for how in ["key", "extension"] {
        let mut a = Accounts::default();
        let (remote, _) =
            p::remote::Remote::parse(&format!("bunker://{key}?relay=wss://local.test"))
                .expect("remote");
        a.add_remote(key.clone(), remote).expect("add remote");
        a.add(how, Some(if how == "key" { &nsec } else { &key }))
            .expect("replace");
        let restored: Accounts =
            serde_json::from_str(&serde_json::to_string(&a).expect("persist")).expect("restore");
        assert!(restored.remote(&key).is_none());
        let signed = restored
            .sign(&p::UnsignedNostrEvent {
                pubkey: key.clone(),
                created_at: 1,
                kind: 1,
                tags: vec![],
                content: "test".into(),
            })
            .expect("selected signer");
        assert_eq!(signed.is_some(), how == "key");
    }
}

#[test]
fn evicted_owner_events_do_not_become_evidence_of_empty_lists() {
    let mut e = Engine::new();
    e.store = lkjstr_core::store::Store::with_caps(1, 1);
    let list = event(1, 3, "", vec![vec!["p".into(), "a".repeat(64)]]);
    let key = list.pubkey.clone();
    e.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    open(
        &mut e,
        Query {
            account: Some(key.clone()),
            ..Default::default()
        },
    );
    e.network.connected(RELAY, 1);
    let req = frames(&mut e)
        .into_iter()
        .find(|f| f[0] == "REQ" && f[2]["authors"] == json!([key]))
        .expect("owner lookup");
    e.network
        .message(RELAY, &json!(["EVENT", req[1], list]).to_string(), 2);
    e.store.insert(list, None);
    e.network
        .message(RELAY, &json!(["EOSE", req[1]]).to_string(), 3);
    e.store.insert(event(4, 0, "{}", vec![]), None);
    assert!(e.store.replaceable(&key, 3).is_none());
    e.drain();
    e.input(
        Input::Action {
            req: "follow".into(),
            account: key,
            action: Action::Follow {
                pubkey: "b".repeat(64),
                value: true,
            },
        },
        5,
    );
    assert!(
        e.drain()
            .iter()
            .any(|o| matches!(o, Output::Error{code,..} if code=="list-not-loaded"))
    );
}
