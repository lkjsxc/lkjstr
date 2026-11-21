#![allow(clippy::expect_used)]
use super::*;

fn route(url: &str, write: bool) -> RelayConfig {
    RelayConfig {
        url: url.into(),
        read: true,
        write,
        search: false,
    }
}

#[test]
fn cached_writers_and_ready_writers_exclude_a_connected_read_only_relay() {
    let mut engine = Engine::new();
    let owner = "aa".repeat(32);
    let fixture = WriteRelayList {
        id: "bb".repeat(32),
        at: 5,
        urls: vec!["wss://slow.test/".into(), "wss://read.test/".into()],
        read_only: Vec::new(),
    };
    engine.configure_note_routes(
        Some(owner.clone()),
        Some(vec![
            route("wss://read.test/", false),
            route("wss://fast.test/", true),
        ]),
        Some(fixture.clone()),
        None,
    );
    for url in [
        "wss://fast.test/",
        "wss://read.test/",
        "wss://unrelated.test/",
    ] {
        engine.network.relays.entry(url.into()).or_default().online = true;
    }
    let mut input = PublicationInput::default();
    let policy = engine.note_route_policy(&owner);
    let defaults = engine.note_write_routes(&owner, &mut input, &policy);
    assert_eq!(policy.list.as_ref().map(|list| &list.id), Some(&fixture.id));
    assert_eq!(input.own, ["wss://fast.test/", "wss://slow.test/"]);
    assert!(defaults.is_empty());
}

#[test]
fn default_write_routes_are_available_immediately_when_no_account_routes_are_known() {
    let mut engine = Engine::new();
    let owner = "aa".repeat(32);
    let routes = vec!["wss://fallback.test/".to_string()];
    engine.configure_note_routes(
        Some(owner.clone()),
        Some(vec![route("wss://read.test/", false)]),
        None,
        Some(vec![routes[0].clone(), "wss://read.test/".into()]),
    );
    let mut input = PublicationInput::default();
    let policy = engine.note_route_policy(&owner);
    let defaults = engine.note_write_routes(&owner, &mut input, &policy);
    assert!(policy.list.is_none());
    assert_eq!(input.own, routes);
    assert_eq!(defaults, routes);
}

#[test]
fn a_read_only_route_cannot_receive_a_note_after_an_opt_out_during_connect() {
    let peer = "wss://read.test/";
    let event = lkjstr_protocol::finalize_event(
        &lkjstr_protocol::EventTemplate {
            pubkey: None,
            created_at: 1,
            kind: 1,
            tags: vec![],
            content: "Local fixture".into(),
        },
        &lkjstr_protocol::generate_secret_key(),
    )
    .expect("signed local fixture");
    let mut engine = Engine::new();
    let id = event.id.clone();
    engine.network.publish(
        "probe".into(),
        event,
        super::super::publication_plan::plan(PublicationInput {
            own: vec![peer.into()],
            ..Default::default()
        }),
        1000,
    );
    engine
        .network
        .apply_note_opt_out(&id, &BTreeSet::from([peer.into()]));
    engine.network.connected(peer, 1001);
    assert!(!engine.network.drain_effects().iter().any(|effect| {
        matches!(effect, super::super::network::Effect::Send(url, frame) if url == peer && frame.starts_with("[\"EVENT\""))
    }));
}

#[test]
fn a_write_opt_out_also_applies_to_late_background_waves() {
    let event = lkjstr_protocol::finalize_event(
        &lkjstr_protocol::EventTemplate {
            pubkey: None,
            created_at: 1,
            kind: 1,
            tags: vec![],
            content: "Local fixture".into(),
        },
        &lkjstr_protocol::generate_secret_key(),
    )
    .expect("signed local fixture");
    let id = event.id.clone();
    let author = event.pubkey.clone();
    let routes: Vec<_> = (0..13).map(|n| format!("wss://route-{n}.test/")).collect();
    let mut engine = Engine::new();
    engine.network.publish(
        "probe".into(),
        event,
        super::super::publication_plan::plan_note(PublicationInput {
            own: routes.clone(),
            ..Default::default()
        }),
        0,
    );
    engine.network.connected(&routes[0], 1);
    engine.network.message(
        &routes[0],
        &serde_json::json!(["OK", id, true, ""]).to_string(),
        2,
    );
    let last = &routes[12];
    engine.network.tick(31_000);
    engine.network.connected(last, 31_001);
    engine.configure_note_routes(Some(author), Some(vec![route(last, false)]), None, None);
    engine.publication_wants(31_002);
    let effects = engine.network.drain_effects();
    assert!(effects.iter().any(|effect| matches!(
        effect, super::super::network::Effect::Connect(url) if url == last
    )));
    assert!(!effects.iter().any(|effect| matches!(
        effect, super::super::network::Effect::Send(url, frame)
            if url == last && frame.starts_with("[\"EVENT\"")
    )));
}
