//! Drive actual Engine wants through the deterministic transport.
use super::{
    fixture::{Failure, Fixture, HORIZON, START},
    metrics::Metrics,
    transport::Transport,
};
use lkjstr_core::engine::{Engine, protocol::Input};
use serde_json::{Value, json};

pub fn run(fixture: &Fixture, reverse_open: bool) -> Result<Value, Failure> {
    let mut engine = Engine::new();
    engine.store = fixture.store();
    engine.input(
        Input::Configure {
            relays: fixture.relays.iter().map(|r| r.url.clone()).collect(),
        },
        START,
    );
    let admitted = engine.network.relays.len();
    let mut queries = fixture.queries.clone();
    if reverse_open {
        queries.reverse();
    }
    for (sub, query) in queries {
        engine.input(Input::Open { sub, query }, START);
    }
    engine.input(
        Input::Hint {
            visible_subs: fixture
                .queries
                .iter()
                .map(|(name, _)| name.clone())
                .collect(),
            focused_sub: Some("home".into()),
            page_hidden: false,
            idle: false,
            save_data: false,
        },
        START,
    );
    let mut transport = Transport::default();
    let mut metrics = Metrics::default();
    let mut milestones = serde_json::Map::new();
    for elapsed in (0..=HORIZON).step_by(10) {
        let now = START + elapsed;
        if elapsed == 12_000 {
            milestones.insert("beforeProfileClose".into(), metrics.counters());
            engine.input(
                Input::Close {
                    sub: "profile-0".into(),
                },
                now,
            );
        }
        if elapsed == 13_000 {
            milestones.insert("beforeProfileReopen".into(), metrics.counters());
            let query = fixture
                .queries
                .iter()
                .find(|(name, _)| name == "profile-0")
                .ok_or("missing profile fixture")?
                .1
                .clone();
            engine.input(
                Input::Open {
                    sub: "profile-0".into(),
                    query,
                },
                now,
            );
        }
        transport.deliver(&mut engine, fixture, &mut metrics, now)?;
        engine.tick(now);
        transport.effects(&mut engine, fixture, &mut metrics, now)?;
        metrics.observe(&engine, fixture, now);
        // Exercise output production while keeping payloads out of the scorecard.
        let _ = engine.drain();
    }
    let mut result = metrics.finish(&engine, fixture);
    result["openOrder"] = json!(if reverse_open { "reversed" } else { "declared" });
    result["configuredCandidates"] = json!(fixture.relays.len());
    result["initiallyAdmittedRelays"] = json!(admitted);
    result["milestones"] = Value::Object(milestones);
    result["networkRequestsAtEnd"] = engine.network.request_stats();
    result["activeSubscriptionsAtEnd"] = json!(engine.network.open_wires().values().sum::<usize>());
    for (sub, _) in &fixture.queries {
        engine.input(Input::Close { sub: sub.clone() }, START + HORIZON + 1);
    }
    transport.effects(&mut engine, fixture, &mut metrics, START + HORIZON + 1)?;
    result["activeSubscriptionsAfterClose"] =
        json!(engine.network.open_wires().values().sum::<usize>());
    Ok(result)
}
