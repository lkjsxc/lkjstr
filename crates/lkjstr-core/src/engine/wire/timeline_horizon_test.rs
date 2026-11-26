#![allow(clippy::expect_used)]

use super::{Engine, Session, Source};
use crate::engine::{protocol as p, wire::Query};
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};

#[test]
fn rail_publishes_a_covered_map_while_the_horizon_continues_to_move() {
    let now = 1_800_000_000_000;
    let owner = generate_secret_key();
    let mut engine = Engine::new();
    let mut account = String::new();
    for created_at in [1, 2] {
        let note = finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at,
                kind: 1,
                content: "Retained post".into(),
                tags: vec![],
            },
            &owner,
        )
        .expect("fixture note");
        account.clone_from(&note.pubkey);
        engine.store.insert(note, None);
    }
    engine.input(
        p::Input::Open {
            sub: "home".into(),
            query: p::Query {
                account: Some(account.clone()),
                source: Source::Home,
                ..Default::default()
            },
        },
        now,
    );
    let mut session = Session::default();
    session.queries.insert(
        "home".into(),
        Query {
            source: "home".into(),
            account: Some(account),
            ..Default::default()
        },
    );
    for (elapsed, horizon) in [(0, Some(2)), (25, Some(1)), (50, None)] {
        engine
            .views
            .get_mut("home")
            .expect("engine view")
            .history_horizon = horizon;
        session.timeline_tick(&engine, now + elapsed);
    }
    let map = session.timeline_tick(&engine, now + 100);
    assert!(map.iter().any(
        |output| matches!(output, super::Output::Timeline { timeline, .. }
        if timeline["oldest"] == 2000 && timeline["months"][0]["count"] == 1 && timeline["clock"][0][3] == 1)
    ));
    session.timeline_tick(&engine, now + 125);
    let map = session.timeline_tick(&engine, now + 225);
    assert!(map.iter().any(
        |output| matches!(output, super::Output::Timeline { timeline, .. }
        if timeline["oldest"] == 1000 && timeline["months"][0]["count"] == 2 && timeline["clock"][0][3] == 2)
    ));
}
