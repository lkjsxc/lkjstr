#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{accept, frames};
use lkjstr_core::engine::{Engine, wire};
use serde_json::json;
#[test]
fn metadata_seed_discovers_old_creation_on_search_only_route() {
    let key = lkjstr_protocol::generate_secret_key();
    let event = |at, kind, text: &str, tags| {
        lkjstr_protocol::finalize_event(
            &lkjstr_protocol::EventTemplate {
                pubkey: None,
                created_at: at,
                kind,
                content: text.into(),
                tags,
            },
            &key,
        )
        .expect("signed channel fixture")
    };
    let relay = "wss://search.test/";
    let mut e = Engine::new();
    e.network.configure(vec![relay.into()], 0);
    let config = e.network.known.get_mut(relay).expect("relay");
    config.read = false;
    config.search = true;
    let mut session = wire::Session::default();
    accept(
        &mut session,
        &mut e,
        json!({"t":"open","sub":"channels","query":{"source":"channels","since":999999}}),
        0,
    );
    e.network.connected(relay, 1);
    e.network.tick(201);
    let initial = frames(&mut e);
    assert!(
        initial
            .iter()
            .any(|f| f[0] == "REQ" && f[2]["kinds"] == json!([40]) && f[2]["since"].is_null())
    );
    let seed = initial
        .iter()
        .find(|f| f[0] == "REQ" && f[2]["kinds"] == json!([41]))
        .expect("metadata discovery");
    let creation = event(1, 40, r#"{"name":"old channel"}"#, vec![]);
    let update = event(
        100,
        41,
        r#"{"name":"current name"}"#,
        vec![vec!["e".into(), creation.id.clone()]],
    );
    let verified = e
        .network
        .message(relay, &json!(["EVENT", seed[1], update]).to_string(), 202)
        .expect("metadata match");
    e.enqueue(relay.into(), verified);
    e.tick(401);
    e.tick(601);
    let lookup = frames(&mut e)
        .into_iter()
        .find(|f| f[0] == "REQ" && f[2]["ids"] == json!([creation.id]))
        .expect("creation lookup");
    let verified = e
        .network
        .message(
            relay,
            &json!(["EVENT", lookup[1], creation]).to_string(),
            602,
        )
        .expect("creation match");
    e.enqueue(relay.into(), verified);
    e.tick(701);
    let outputs = engine_review_support::output(&mut session, &mut e);
    assert!(
        outputs
            .iter()
            .any(|v| v.to_string().contains("current name"))
    );
    println!(
        "channel scorecard metadata_only_index before_rows=0 after_rows=1 verified_creations=1"
    );
}
