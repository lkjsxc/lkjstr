#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{event, frames};
use lkjstr_core::engine::{Engine, accounts::Accounts, wire::RelayConfig};
use lkjstr_protocol::{ProfilePointer, encode_nprofile};
#[test]
fn imported_hints_are_bounded_and_discovery_does_not_enable_publishing() {
    let owner = event(1, 1, "owner", vec![]).pubkey;
    let pointer = encode_nprofile(&ProfilePointer {
        pubkey: owner.clone(),
        relays: Some(vec!["wss://hint.test".into()]),
    })
    .expect("pointer");
    let mut accounts = Accounts::default();
    accounts.add("key", Some(&pointer)).expect("import");
    assert_eq!(accounts.require_signer(&owner), Err("read-only"));
    assert_eq!(accounts.require_signer(&"0".repeat(64)), Err("signed-out"));
    assert_eq!(accounts.entries[0].relay_hints, vec!["wss://hint.test/"]);
    let mut e = Engine::new();
    e.configure_relays(
        vec![RelayConfig {
            url: "wss://bootstrap.test/".into(),
            read: true,
            write: true,
            search: false,
        }],
        0,
    )
    .expect("bootstrap");
    e.discover_account(Some(owner), accounts.entries[0].relay_hints.clone(), 0);
    assert!(!e.network.known["wss://hint.test/"].read);
    assert!(!e.network.known["wss://hint.test/"].write);
    e.input(
        lkjstr_core::engine::protocol::Input::Hint {
            focused_sub: None,
            visible_subs: vec![],
            page_hidden: false,
            idle: false,
            save_data: false,
        },
        1,
    );
    e.network.connected("wss://hint.test/", 1);
    assert!(frames(&mut e).iter().any(|f| {
        f[0] == "REQ"
            && f[2]["kinds"]
                .as_array()
                .is_some_and(|kinds| kinds.len() == 1)
    }));
    e.discover_account(
        Some("a".repeat(64)),
        vec!["wss://next-hint.test/".into()],
        2,
    );
    assert!(!e.network.relays.contains_key("wss://hint.test/"));
}
#[test]
fn repeated_nip65_roles_merge_and_newest_owner_list_wins() {
    let mut e = Engine::new();
    let row = event(
        1,
        10002,
        "",
        vec![
            vec!["r".into(), "wss://owner.test".into(), "read".into()],
            vec!["r".into(), "wss://owner.test/".into(), "write".into()],
        ],
    );
    let owner = row.pubkey.clone();
    e.store.insert(row, None);
    let entries = e.account_relays(&owner).expect("list").1;
    assert_eq!(entries.len(), 1);
    assert!(entries[0].read && entries[0].write);
}

#[test]
fn changing_account_hints_keeps_the_known_relay_collection_bounded() {
    let mut n = lkjstr_core::engine::network::Network::default();
    for i in 0..100 {
        n.configure(vec![format!("wss://relay-{i}.test/")], i);
    }
    assert_eq!(n.known.len(), 64);
    assert_eq!(n.relays.len(), 1);
    assert!(n.known.contains_key("wss://relay-99.test/"));
}
