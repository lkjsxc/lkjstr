#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{accept, output};
use lkjstr_core::engine::{Engine, network::Effect, protocol::Input, wire::Session};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};
use serde_json::{Value, json};

const A: &str = "wss://fast.test/";
const B: &str = "wss://slow.test/";
const C: &str = "wss://replacement.test/";
const NOW: u64 = 1_800_000_000_000;

fn home_wires(engine: &mut Engine, now: u64) -> [String; 2] {
    let mut wires = [String::new(), String::new()];
    for i in 0..20 {
        engine.tick(now + i * 100);
        for effect in engine.network.drain_effects() {
            if let Effect::Send(relay, text) = effect {
                let frame: Vec<Value> = serde_json::from_str(&text).expect("relay frame");
                if frame[0] == "REQ"
                    && frame.iter().skip(2).any(|f| {
                        f["authors"].as_array().is_some_and(|a| a.len() == 2)
                            && f["kinds"].as_array().is_some_and(|k| k.contains(&json!(1)))
                    })
                {
                    wires[usize::from(relay == B)] = frame[1].as_str().expect("wire id").into();
                }
            }
        }
        if wires.iter().all(|wire| !wire.is_empty()) {
            return wires;
        }
    }
    assert!(
        wires.iter().all(|wire| !wire.is_empty()),
        "both Home routes must be asked"
    );
    wires
}

fn message(engine: &mut Engine, relay: &str, frame: Value, now: u64) {
    if let Some(event) = engine.network.message(relay, &frame.to_string(), now) {
        engine.enqueue(relay.into(), event);
    }
}

fn rows(session: &mut Session, engine: &mut Engine, now: u64) -> Value {
    accept(
        session,
        engine,
        json!({"t":"window","sub":"home","anchor":"top","before":0,"after":60}),
        now,
    );
    output(session, engine)
        .into_iter()
        .rev()
        .find(|r| r["t"] == "rows" && r["sub"] == "home")
        .expect("Home window")
}

fn rail(session: &mut Session, engine: &Engine, now: u64) -> Value {
    (0..20)
        .flat_map(|i| session.timeline_tick(engine, now + i * 25))
        .filter_map(|m| serde_json::to_value(m).ok())
        .filter(|m| m["sub"] == "home")
        .last()
        .expect("Home timeline")["timeline"]
        .clone()
}

fn ids(window: &Value) -> Vec<&str> {
    window["rows"]
        .as_array()
        .expect("rows")
        .iter()
        .map(|row| row["id"].as_str().expect("note id"))
        .collect()
}

fn scenario(timeout: bool) {
    let owner = generate_secret_key();
    let follower = generate_secret_key();
    let sign = |key, at, kind, tags| -> NostrEvent {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: at,
                kind,
                tags,
                content: format!("history fixture {at}"),
            },
            key,
        )
        .expect("signed fixture")
    };
    let recent = sign(&follower, 1_799_999_997, 1, vec![]);
    let middle = sign(&follower, 1_797_000_000, 1, vec![]);
    let old = sign(&owner, 1_750_000_000, 1, vec![]);
    let follow = sign(
        &owner,
        1_700_000_000,
        3,
        vec![vec!["p".into(), recent.pubkey.clone()]],
    );
    let mut engine = Engine::new();
    let mut session = Session::default();
    engine.store.insert(follow, None);
    engine.input(
        Input::Configure {
            relays: vec![A.into(), B.into()],
        },
        NOW,
    );
    accept(
        &mut session,
        &mut engine,
        json!({"t":"open","sub":"home","query":{"source":"home","account":old.pubkey}}),
        NOW,
    );
    engine.network.connected(A, NOW + 1);
    engine.network.connected(B, NOW + 1);
    let [fast, slow] = home_wires(&mut engine, NOW + 10);
    engine.store.insert(old.clone(), None);
    message(&mut engine, A, json!(["EVENT", fast, recent]), NOW + 2_050);
    message(&mut engine, A, json!(["EOSE", fast]), NOW + 2_051);
    message(&mut engine, B, json!(["EVENT", slow, recent]), NOW + 2_052);
    engine.tick(NOW + 2_100);
    let limited = rows(&mut session, &mut engine, NOW + 2_101);
    assert_eq!(ids(&limited), [recent.id.as_str()]);
    assert_eq!(limited["atBottom"], false);
    let map = rail(&mut session, &engine, NOW + 2_200);
    assert_eq!(map["oldest"], recent.created_at * 1000);
    assert_eq!(map["months"].as_array().expect("months").len(), 1);
    assert!(engine.store.lease(&old.id).is_some());

    accept(
        &mut session,
        &mut engine,
        json!({"t":"open","sub":"profile","query":{"source":"profile","pubkey":old.pubkey}}),
        NOW + 2_550,
    );
    assert!(output(&mut session, &mut engine).iter().any(|m| {
        m["sub"] == "profile"
            && m["rows"]
                .as_array()
                .is_some_and(|r| r.iter().any(|r| r["id"] == old.id))
    }));
    if timeout {
        engine.tick(NOW + 4_001);
        let expired = rows(&mut session, &mut engine, NOW + 4_002);
        assert_eq!(ids(&expired), [recent.id.as_str(), old.id.as_str()]);
        assert_eq!(expired["atBottom"], false);
        engine.input(
            Input::Configure {
                relays: vec![A.into(), C.into()],
            },
            NOW + 4_100,
        );
        assert!(
            engine
                .network
                .drain_effects()
                .iter()
                .any(|effect| { matches!(effect, Effect::Connect(relay) if relay == C) })
        );
        let replaced = rows(&mut session, &mut engine, NOW + 4_101);
        assert_eq!(ids(&replaced), [recent.id.as_str(), old.id.as_str()]);
        assert_eq!(replaced["atBottom"], false);
    } else {
        message(&mut engine, B, json!(["EVENT", slow, middle]), NOW + 2_650);
        engine.tick(NOW + 2_700);
        assert_eq!(
            ids(&rows(&mut session, &mut engine, NOW + 2_701)),
            [recent.id.as_str(), middle.id.as_str()]
        );
        message(&mut engine, B, json!(["EOSE", slow]), NOW + 2_750);
        engine.tick(NOW + 2_800);
        assert_eq!(
            ids(&rows(&mut session, &mut engine, NOW + 2_801)),
            [recent.id.as_str(), middle.id.as_str(), old.id.as_str()]
        );
        assert_eq!(
            rail(&mut session, &engine, NOW + 2_900)["oldest"],
            old.created_at * 1000
        );
    }
}

#[test]
fn slow_home_route_releases_older_rows_and_rail_together() {
    scenario(false);
}

#[test]
fn silent_tail_releases_after_four_seconds_without_claiming_exhaustion() {
    scenario(true);
}

#[test]
fn home_waiting_for_follows_does_not_open_with_only_its_owners_cached_history() {
    let own = engine_review_support::event(1_750_000_000, 1, "owner's retained note", vec![]);
    let mut engine = Engine::new();
    let mut session = Session::default();
    engine.store.insert(own.clone(), None);
    engine.input(
        Input::Configure {
            relays: vec![A.into(), B.into()],
        },
        NOW,
    );
    accept(
        &mut session,
        &mut engine,
        json!({"t":"open","sub":"home","query":{"source":"home","account":own.pubkey}}),
        NOW,
    );
    assert!(output(&mut session, &mut engine).iter().any(|out| {
        out["sub"] == "home"
            && out["rows"].as_array().is_some_and(Vec::is_empty)
            && out["atBottom"] == false
    }));
    assert!(engine.store.lease(&own.id).is_some());
}
