#![allow(clippy::expect_used, clippy::panic)]
use lkjstr_core::engine::{
    Engine,
    network::Effect,
    protocol::{Input, Output, Query, Source},
};
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};
use serde_json::{Value, json};
fn setup() -> Engine {
    let mut e = Engine::new();
    e.input(
        Input::Configure {
            relays: vec![
                "wss://a.test".into(),
                "wss://b.test".into(),
                "wss://c.test".into(),
            ],
        },
        0,
    );
    e.input(
        Input::Open {
            sub: "feed".into(),
            query: Query::default(),
        },
        0,
    );
    e.network.drain_effects();
    e.network.connected("wss://a.test/", 10);
    e.network.connected("wss://b.test/", 10);
    e
}
fn reqs(e: &mut Engine) -> Vec<(String, Value)> {
    e.network
        .drain_effects()
        .into_iter()
        .filter_map(|f| match f {
            Effect::Send(r, text) => {
                let v: Value = serde_json::from_str(&text).expect("frame");
                (v[0] == "REQ").then_some((r, v))
            }
            _ => None,
        })
        .collect()
}
#[test]
fn identical_views_share_work_and_visibility_releases_it() {
    let mut e = setup();
    let frames = reqs(&mut e);
    assert_eq!(frames.len(), 2);
    e.input(
        Input::Open {
            sub: "other".into(),
            query: Query::default(),
        },
        20,
    );
    assert!(reqs(&mut e).is_empty());
    e.input(
        Input::Hint {
            focused_sub: None,
            visible_subs: vec![],
            page_hidden: false,
            idle: false,
            save_data: false,
        },
        25,
    );
    assert!(
        e.network
            .drain_effects()
            .iter()
            .any(|f| matches!(f,Effect::Send(_,t) if t.contains("CLOSE")))
    );
}
#[test]
fn hours_of_silence_reconnect_then_resubscribe_with_since() {
    let mut e = setup();
    let heads = reqs(&mut e);
    let event = finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 100,
            kind: 1,
            tags: vec![],
            content: "before idle".into(),
        },
        &generate_secret_key(),
    )
    .expect("fixture");
    e.enqueue("wss://a.test/".into(), event);
    e.tick(75);
    // Incremental reconnect is safe only after the original history completed.
    for (relay, head) in heads {
        e.network
            .message(&relay, &json!(["EOSE", head[1]]).to_string(), 76);
    }
    e.drain();
    e.network.drain_effects();
    e.tick(3 * 60 * 60 * 1000);
    assert!(
        e.network
            .drain_effects()
            .iter()
            .any(|f| matches!(f, Effect::Disconnect(_)))
    );
    e.tick(3 * 60 * 60 * 1000 + 65000);
    assert!(
        e.network
            .drain_effects()
            .iter()
            .any(|f| matches!(f, Effect::Connect(_)))
    );
    e.network
        .connected("wss://a.test/", 3 * 60 * 60 * 1000 + 65001);
    let frames = reqs(&mut e);
    assert!(frames.iter().any(|(_, f)| f[2]["since"] == 98));
    let event = finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 11000,
            kind: 1,
            tags: vec![],
            content: "after idle".into(),
        },
        &generate_secret_key(),
    )
    .expect("fixture");
    e.enqueue("wss://a.test/".into(), event);
    e.tick(3 * 60 * 60 * 1000 + 65100);
    assert!(e.drain().iter().any(|o| matches!(o, Output::Patch { .. })));
}
#[test]
fn missing_lookups_settle_after_two_relays_and_silent_peer_errors() {
    let mut e = setup();
    let frames = reqs(&mut e);
    for (relay, frame) in frames {
        let id = frame[1].as_str().expect("id");
        e.network
            .message(&relay, &json!(["EOSE", id]).to_string(), 20);
    }
    e.tick(75);
    assert!(
        e.drain()
            .iter()
            .any(|o| matches!(o,Output::Status{state,asked_relays:2,..} if state=="not-found"))
    );
    e.input(
        Input::Open {
            sub: "missing".into(),
            query: Query {
                source: Source::Search,
                target: Some("missing".into()),
                ..Default::default()
            },
        },
        100,
    );
    e.tick(200);
    reqs(&mut e);
    e.tick(16000);
    assert!(
        e.drain()
            .iter()
            .any(|o| matches!(o,Output::Status{sub,state,..} if sub=="missing" && state=="error"))
    );
}
#[test]
fn concurrent_requests_are_capped() {
    let mut e = setup();
    reqs(&mut e);
    for i in 0..40 {
        e.input(
            Input::Open {
                sub: format!("s{i}"),
                query: Query {
                    source: Source::Profile,
                    target: Some(format!("{i:064x}")),
                    ..Default::default()
                },
            },
            20,
        );
    }
    let stats = e.network.stats();
    assert!(
        stats
            .as_array()
            .expect("stats")
            .iter()
            .all(|s| s["activeReqs"].as_u64().unwrap_or(0) <= 4)
    );
}
