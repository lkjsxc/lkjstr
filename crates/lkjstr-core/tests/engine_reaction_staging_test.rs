#![allow(clippy::expect_used)]
mod engine_review_support;

use engine_review_support::{RELAY, event, frames};
use lkjstr_core::engine::{
    Engine,
    accounts::Accounts,
    protocol::{Action, Input, Output, Query, Source},
    wire::RelayConfig,
};
use serde_json::json;

fn reaction(
    engine: &mut Engine,
    signer: &Accounts,
    req: &str,
    target: &str,
    content: String,
) -> String {
    let account = signer.active.clone().expect("local test account");
    engine.input(
        Input::Action {
            req: req.into(),
            account,
            action: Action::Publish {
                kind: "reaction".into(),
                content,
                target: Some(target.into()),
                tags: vec![],
            },
        },
        100_000,
    );
    let unsigned = engine
        .drain()
        .into_iter()
        .find_map(|output| match output {
            Output::Sign { event, .. } => Some(event),
            _ => None,
        })
        .expect("action requests signing");
    let signed = signer
        .sign(&unsigned)
        .expect("key signs")
        .expect("local signer");
    let id = signed.id.clone();
    engine.input(
        Input::Signed {
            req: req.into(),
            event: Some(signed),
            error: None,
        },
        100_001,
    );
    id
}

fn at_capacity(engine: &mut Engine, name: &str) {
    assert!(engine.drain().into_iter().any(|output| {
        matches!(output, Output::Error { req: Some(req), code }
            if req == name && code == "publication-limit")
    }));
}

#[test]
fn reactions_share_the_tick_and_admit_only_distinct_available_publications() {
    let mut engine = Engine::new();
    engine
        .configure_relays(
            vec![RelayConfig {
                url: RELAY.into(),
                read: true,
                write: true,
                search: false,
            }],
            100_000,
        )
        .expect("fixture");
    let target = event(1, 1, "target", vec![]);
    engine.store.insert(target.clone(), None);
    let mut signer = Accounts::default();
    signer.add("create", None).expect("disposable signer");
    engine.input(
        Input::Open {
            sub: "visible-global".into(),
            query: Query {
                source: Source::Global,
                account: signer.active.clone(),
                ..Default::default()
            },
        },
        100_000,
    );
    engine.network.connected(RELAY, 100_000);
    frames(&mut engine);

    let first = reaction(&mut engine, &signer, "first", &target.id, "+".into());
    assert!(engine.network.pending_event(&first));
    let duplicate = reaction(&mut engine, &signer, "duplicate", &target.id, "+".into());
    assert_eq!(duplicate, first);
    at_capacity(&mut engine, "duplicate");
    for index in 0..63 {
        reaction(
            &mut engine,
            &signer,
            &format!("fixture-{index}"),
            &target.id,
            format!("reaction-{index}"),
        );
    }
    let overflow = reaction(&mut engine, &signer, "overflow", &target.id, "-".into());
    at_capacity(&mut engine, "overflow");
    assert!(engine.store.get(&overflow).is_none());
    assert!(!engine.network.pending_event(&overflow));
    assert!(frames(&mut engine).iter().all(|frame| frame[0] != "EVENT"));

    engine.tick(100_025);
    let frames = frames(&mut engine);
    let written: Vec<_> = frames.iter().filter(|frame| frame[0] == "EVENT").collect();
    assert_eq!(written.len(), 64);
    let frame = written
        .iter()
        .find(|frame| frame[1]["id"] == first)
        .expect("first valid reaction was sent");
    engine.publication_frame_sent(RELAY, &frame.to_string(), true, 100_025);
    engine
        .network
        .message(RELAY, &json!(["OK", first, true, ""]).to_string(), 100_026);
    assert!(engine.drain().into_iter().any(|output| {
        matches!(output, Output::Result { req, error: None, deliveries, .. }
            if req == "first" && deliveries.iter().any(|relay| relay.state == "accepted"))
    }));
}
