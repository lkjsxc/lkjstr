use super::*;
use engine::{
    Engine,
    protocol::{Input, Query},
};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};

fn signed(kind: u64) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 1,
            kind,
            content: "{}".into(),
            tags: vec![],
        },
        &generate_secret_key(),
    )
    .unwrap_or_else(|_| unreachable!())
}

fn setup(q: Query, metadata: &NostrEvent) -> Engine {
    let mut e = Engine::new();
    e.store.insert(metadata.clone(), None);
    e.network
        .observe_verified("wss://a.test/", metadata, 100_000);
    e.input(
        Input::Open {
            sub: "profile".into(),
            query: q,
        },
        100_001,
    );
    e
}

fn direct(e: &Engine) -> Vec<NostrFilter> {
    direct_at(e, 100_002)
}

fn direct_at(e: &Engine, now: u64) -> Vec<NostrFilter> {
    requests(
        &e.store,
        &e.network,
        &e.views["profile"],
        true,
        &e.private_lists,
        now,
    )
}

#[test]
fn fresh_hinted_profile_metadata_does_not_restart_on_open() {
    let metadata = signed(0);
    let e = setup(
        Query {
            source: Source::Profile,
            target: Some(metadata.pubkey.clone()),
            filters: engine::protocol::Filters {
                relay_hints: vec!["wss://a.test/".into()],
                ..Default::default()
            },
            ..Default::default()
        },
        &metadata,
    );
    let wanted = direct(&e)
        .into_iter()
        .filter(|f| f.kinds.as_deref() == Some(&[0]))
        .count();
    assert_eq!(
        wanted, 0,
        "fresh cached kind 0 must not bypass TTL for a hinted profile"
    );
}

#[test]
fn fresh_implicit_people_context_does_not_refresh_but_explicit_lookup_can() {
    let metadata = signed(0);
    // Explicit author discovery remains an intentional refresh. For bare mention
    // context, choose this known author via a following list.
    let owner = generate_secret_key();
    let contact = finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 1,
            kind: 3,
            content: String::new(),
            tags: vec![vec!["p".into(), metadata.pubkey.clone()]],
        },
        &owner,
    )
    .unwrap_or_else(|_| unreachable!());
    let mut e = setup(
        Query {
            source: Source::People,
            account: Some(contact.pubkey.clone()),
            filters: engine::protocol::Filters {
                text: Some(String::new()),
                ..Default::default()
            },
            ..Default::default()
        },
        &metadata,
    );
    e.store.insert(contact, None);
    assert_eq!(
        direct(&e).len(),
        0,
        "implicit mention context must reuse fresh kind 0"
    );
    e.views
        .get_mut("profile")
        .unwrap_or_else(|| unreachable!())
        .query
        .filters
        .authors = Some(vec![metadata.pubkey]);
    assert_eq!(direct(&e).len(), 1, "explicit lookup remains available");
}

#[test]
fn profile_target_outbox_is_visible_work_not_background_discovery() {
    let metadata = signed(0);
    let e = setup(
        Query {
            source: Source::Profile,
            target: Some(metadata.pubkey.clone()),
            ..Default::default()
        },
        &metadata,
    );
    let wants = e.outbox_wants(100_002);
    let matching: Vec<_> = wants
        .iter()
        .filter(|(_, f, _)| {
            f.authors
                .as_ref()
                .is_some_and(|authors| authors.contains(&metadata.pubkey))
        })
        .collect();
    assert_eq!(matching.len(), 1);
    assert_eq!(matching[0].0, "profile");
}

#[test]
fn stale_profile_target_has_visible_hydration_owner() {
    let metadata = signed(0);
    let mut e = setup(
        Query {
            source: Source::Profile,
            target: Some(metadata.pubkey.clone()),
            ..Default::default()
        },
        &metadata,
    );
    e.network.configure(vec!["wss://a.test/".into()], 1_000_001);
    let wants = e.profile_wants(1_000_001);
    assert!(
        wants.iter().any(|(sub, f, _)| sub == "profile"
            && f.authors
                .as_ref()
                .is_some_and(|a| a.contains(&metadata.pubkey))),
        "{wants:?}"
    );
}

#[test]
fn cached_follow_list_without_freshness_is_refreshed() {
    let list = signed(3);
    let e = setup(
        Query {
            source: Source::Profile,
            target: Some(list.pubkey.clone()),
            ..Default::default()
        },
        &list,
    );
    let owner_lists = direct(&e)
        .into_iter()
        .filter(|f| {
            f.kinds.as_deref() == Some(&[3])
                && f.authors.as_deref() == Some(std::slice::from_ref(&list.pubkey))
        })
        .count();
    assert_eq!(
        owner_lists, 1,
        "cached kind 3 without an owner-query stamp still needs refresh"
    );
}

#[test]
fn owner_list_freshness_survives_reopen_and_quality_restore_then_expires() {
    let list = signed(3);
    let mut e = setup(
        Query {
            source: Source::Profile,
            target: Some(list.pubkey.clone()),
            ..Default::default()
        },
        &list,
    );
    let owner_filter = |f: &NostrFilter| {
        f.kinds.as_deref() == Some(&[3])
            && f.authors.as_deref() == Some(std::slice::from_ref(&list.pubkey))
    };
    let filter = direct(&e)
        .into_iter()
        .find(&owner_filter)
        .unwrap_or_else(|| unreachable!());
    e.network.configure(vec!["wss://a.test/".into()], 100_010);
    e.network.plan(
        vec![("owner".into(), filter, Query::default())],
        &e.store,
        100_010,
    );
    e.network.connected("wss://a.test/", 100_060);
    let wire = e
        .network
        .drain_effects()
        .into_iter()
        .find_map(|effect| {
            let engine::network::Effect::Send(_, frame) = effect else {
                return None;
            };
            let frame: serde_json::Value = serde_json::from_str(&frame).ok()?;
            (frame[0] == "REQ").then(|| frame[1].clone())
        })
        .unwrap_or_else(|| unreachable!());
    e.network.observe_verified("wss://a.test/", &list, 100_070);
    assert!(direct_at(&e, 100_071).iter().any(&owner_filter));
    e.network.message(
        "wss://a.test/",
        &serde_json::json!(["EOSE", wire]).to_string(),
        100_080,
    );
    e.network.plan(vec![], &e.store, 100_081);
    assert!(!direct_at(&e, 100_082).iter().any(&owner_filter));
    let saved = e.network.quality_json(100_083);
    e.network = engine::network::Network::default();
    e.network.configure(vec!["wss://a.test/".into()], 100_084);
    e.network.restore_quality(&saved, 100_084);
    assert!(!direct_at(&e, 100_085).iter().any(&owner_filter));
    assert!(direct_at(&e, 400_070).iter().any(&owner_filter));
}
