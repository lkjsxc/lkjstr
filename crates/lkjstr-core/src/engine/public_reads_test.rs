#![allow(clippy::expect_used)]
use super::*;
use lkjstr_protocol::{EventTemplate, finalize_event, parse_secret_key_hex};

#[test]
fn private_membership_fences_every_projection_for_its_account_only() {
    let key = parse_secret_key_hex(&"11".repeat(32)).expect("synthetic key");
    let event = finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 1_800_000_000,
            kind: 10000,
            content: "encrypted fixture".into(),
            tags: vec![],
        },
        &key,
    )
    .expect("signed policy fixture");
    let mut store = Store::new(10);
    store.insert(event.clone(), None);
    let mut private = PrivateLists::new();
    let account = Some(event.pubkey.clone());
    let query = Query {
        source: Source::Profile,
        account: account.clone(),
        target: Some("22".repeat(32)),
        ..Default::default()
    };
    assert!(allowed(&store, &private, &query));
    private.insert(event.id, vec![]);
    assert!(!allowed(&store, &private, &query));
    for source in [Source::Home, Source::Notifications, Source::Thread] {
        assert!(!allowed(
            &store,
            &private,
            &Query {
                source,
                ..query.clone()
            }
        ));
    }
    assert!(allowed(
        &store,
        &private,
        &Query {
            account: Some("33".repeat(32)),
            ..query.clone()
        }
    ));
    assert!(allowed(
        &store,
        &private,
        &Query {
            account: None,
            ..query
        }
    ));
}

#[test]
fn device_configuration_is_not_a_public_read_projection() {
    let store = Store::new(10);
    let private = PrivateLists::new();
    assert!(!allowed(
        &store,
        &private,
        &Query {
            source: Source::MediaServers,
            ..Default::default()
        }
    ));
    assert!(allowed(
        &store,
        &private,
        &Query {
            source: Source::Channel,
            ..Default::default()
        }
    ));
}
