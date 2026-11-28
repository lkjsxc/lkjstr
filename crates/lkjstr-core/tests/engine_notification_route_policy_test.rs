//! Explicit relay policy survives bounded remembered-route churn.
#![allow(clippy::expect_used)]
mod engine_read_union_support;
use engine_read_union_support::{NOW, event};
use lkjstr_core::engine::{Engine, network::Effect, wire::RelayConfig};
use serde_json::{Value, json};

const DENIED: &str = "wss://policy-00.test/";
const HINT: &str = "wss://zz-new-hint.test/";

fn owner() -> String {
    event(1, 1, 1, vec![]).pubkey
}

fn disabled_routes() -> Vec<RelayConfig> {
    (0..64)
        .map(|index| RelayConfig {
            url: format!("wss://policy-{index:02}.test/"),
            read: false,
            write: false,
            search: false,
        })
        .collect()
}

fn has_notification(effects: &[Effect], relay: &str) -> bool {
    effects.iter().any(|effect| {
        let Effect::Send(url, text) = effect else {
            return false;
        };
        if url != relay {
            return false;
        }
        let frame: Value = serde_json::from_str(text).expect("relay frame");
        frame[0] == "REQ"
            && frame.as_array().expect("REQ")[2..].iter().any(|filter| {
                filter["#p"] == json!([owner()])
                    && filter["kinds"]
                        .as_array()
                        .is_some_and(|kinds| kinds.contains(&json!(7)))
            })
    })
}

fn accept_inbox_list(engine: &mut Engine, now: u64) {
    let list = event(
        1,
        now / 1000,
        10002,
        vec![vec!["r".into(), DENIED.into(), "read".into()]],
    );
    let id = list.id.clone();
    engine.enqueue("cache".into(), list);
    engine.tick(now);
    assert!(
        engine.store.get(&id).is_some(),
        "the advertised inbox comes from a signature-verified NIP-65 event"
    );
}

#[test]
fn explicit_notification_inbox_denial_survives_remembered_route_eviction_and_reinsertion() {
    let mut engine = Engine::new();
    engine
        .configure_relays(disabled_routes(), NOW)
        .expect("64 explicit disabled routes");
    assert_eq!(engine.relay_rows().len(), 64);
    assert!(
        engine
            .relay_rows()
            .iter()
            .any(|row| row["url"] == DENIED && row["read"] == false)
    );

    engine.discover_account(Some(owner()), vec![HINT.into()], NOW + 1);
    assert_eq!(engine.relay_rows().len(), 64);
    assert!(
        engine.relay_rows().iter().all(|row| row["url"] != DENIED),
        "the new hint must exercise actual eviction from remembered transport rows"
    );
    engine.network.drain_effects();
    accept_inbox_list(&mut engine, NOW + 10);
    let effects = engine.network.drain_effects();
    assert!(
        !effects.iter().any(|effect| {
            matches!(effect, Effect::Inspect(url) | Effect::Connect(url) if url == DENIED)
        }),
        "verified advertisement cannot restore transport admission for an explicit denial"
    );
    engine.network.connected(DENIED, NOW + 11);
    assert!(
        !has_notification(&engine.network.drain_effects(), DENIED),
        "evicted usage metadata must not erase explicit read policy"
    );

    // Reintroducing the same URL as an account hint must not grant public reads.
    engine.discover_account(Some(owner()), vec![HINT.into(), DENIED.into()], NOW + 101);
    assert!(
        engine
            .relay_rows()
            .iter()
            .any(|row| row["url"] == DENIED && row["read"] == false)
    );
    engine.network.connected(DENIED, NOW + 110);
    assert!(
        !has_notification(&engine.network.drain_effects(), DENIED),
        "hint reinsertion must preserve the explicit notification read denial"
    );
}

#[test]
fn replacing_current_relay_policy_releases_an_old_denial_without_granting_global_usage() {
    let mut engine = Engine::new();
    engine
        .configure_relays(
            vec![RelayConfig {
                url: DENIED.into(),
                read: false,
                write: false,
                search: false,
            }],
            NOW,
        )
        .expect("explicit denied inbox");
    engine.discover_account(Some(owner()), vec![HINT.into()], NOW + 1);
    accept_inbox_list(&mut engine, NOW + 10);
    engine.network.connected(DENIED, NOW + 11);
    assert!(!has_notification(&engine.network.drain_effects(), DENIED));

    // Worker replaces this policy when the active relay owner changes.
    engine
        .configure_relays(
            vec![RelayConfig {
                url: HINT.into(),
                read: true,
                write: false,
                search: false,
            }],
            NOW + 101,
        )
        .expect("replacement current-owner policy");
    engine.network.connected(DENIED, NOW + 110);
    assert!(
        has_notification(&engine.network.drain_effects(), DENIED),
        "a removed explicit denial must not become permanent across owner changes"
    );
    assert!(
        engine
            .relay_rows()
            .iter()
            .filter(|row| row["url"] == DENIED)
            .all(|row| row["read"] == false && row["write"] == false),
        "query-scoped inbox admission must not grant global read or write usage"
    );

    engine
        .configure_relays(
            vec![RelayConfig {
                url: DENIED.into(),
                read: false,
                write: false,
                search: false,
            }],
            NOW + 201,
        )
        .expect("restore explicit denial");
    engine.network.connected(DENIED, NOW + 210);
    assert!(
        !has_notification(&engine.network.drain_effects(), DENIED),
        "a later explicit denial must take effect on the current live notification head"
    );
}
