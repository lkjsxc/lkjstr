#![allow(clippy::expect_used)]
use super::*;
use crate::engine::Engine;
use crate::engine::fetch_records::{self as records, ResourceClass};
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};

const RELAY: &str = "wss://records.test/";
const NOW: u64 = 200_000;
fn event(kind: u64) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 100,
            kind,
            content: "private-content-marker".into(),
            tags: vec![],
        },
        &generate_secret_key(),
    )
    .expect("signed event")
}
fn request(engine: &mut Engine, kind: u64, enabled: bool) -> (String, usize, Vec<String>) {
    engine.network.fetches.set_decisions(enabled);
    engine.network.configure(vec![RELAY.into()], NOW);
    let filter = NostrFilter {
        kinds: Some(vec![kind]),
        limit: Some(10),
        ..Default::default()
    };
    engine.network.plan(
        vec![("fixture-view".into(), filter, Query::default())],
        &engine.store,
        NOW,
    );
    engine.network.connected(RELAY, NOW + 10);
    let effects: Vec<_> = engine
        .network
        .drain_effects()
        .into_iter()
        .filter_map(|e| match e {
            Effect::Send(_, frame) => Some(frame),
            _ => None,
        })
        .collect();
    let req = effects
        .iter()
        .find_map(|text| {
            let v: Value = serde_json::from_str(text).ok()?;
            (v[0] == "REQ").then(|| (v[1].as_str().expect("wire").to_owned(), text.len()))
        })
        .expect("REQ");
    (req.0, req.1, effects)
}

#[test]
fn public_resource_records_and_baseline_decisions() {
    for (kind, class) in [
        (1, ResourceClass::Notes),
        (5, ResourceClass::Deletions),
        (7, ResourceClass::Counts),
        (0, ResourceClass::Profiles),
        (10002, ResourceClass::RelayLists),
        (3, ResourceClass::Lists),
    ] {
        let mut baseline = Engine::new();
        let mut engine = Engine::new();
        let (_, _, baseline_effects) = request(&mut baseline, kind, false);
        let (wire, req_bytes, effects) = request(&mut engine, kind, true);
        assert_eq!(effects, baseline_effects, "kind {kind}");
        let event = event(kind);
        let frame = json!(["EVENT", wire, event]).to_string();
        let accepted = engine
            .network
            .message(RELAY, &frame, NOW + 20)
            .expect("matched event");
        engine.enqueue(RELAY.into(), accepted);
        let eose = json!(["EOSE", wire]).to_string();
        engine.network.message(RELAY, &eose, NOW + 21);
        engine.tick(NOW + 22);
        let observer = &engine.network.fetches;
        observer.inspect(|l| {
            let resource = l
                .records()
                .find(|r| r.scope == records::Scope::Resource)
                .expect("resource record");
            assert_eq!(resource.class, class);
            assert_eq!(resource.source, records::Source::Network);
            assert_eq!(resource.origin(), Some("wss://records.test"));
            assert_eq!(
                resource.wire_bytes,
                records::WireBytes::Measured(frame.len() as u64)
            );
            assert_eq!(resource.start_ms, Some(NOW + 10));
            assert_eq!(resource.first_byte_ms, Some(NOW + 20));
            assert_eq!(resource.end_ms, NOW + 20);
            assert!(resource.view.is_some() && resource.slot.is_some());
            assert_ne!(resource.outcome, records::Outcome::PendingVerification);
            assert!(resource.stored_bytes.is_some());
            let request = l
                .records()
                .find(|r| r.scope == records::Scope::Request)
                .expect("request record");
            assert_eq!(
                request.wire_bytes,
                records::WireBytes::Measured((req_bytes + eose.len()) as u64)
            );
            assert_eq!(request.connection, records::Connection::New);
            assert_eq!(request.outcome, records::Outcome::Ok);
            assert_eq!(
                l.totals[&class].measured_bytes,
                (req_bytes + eose.len() + frame.len()) as u64
            );
            assert!(
                l.decisions()
                    .any(|d| d.action == records::Action::Fetch && !d.chosen.is_empty())
            );
            let json = serde_json::to_string(l).expect("serialized local diagnostics");
            assert!(
                !json.contains("private-content-marker")
                    && !json.contains(&event.id)
                    && !json.contains("fixture-view")
            );
        });
        assert_eq!(
            baseline.network.fetches.inspect(|l| l.decisions().count()),
            0
        );
    }
}

#[test]
fn zero_yield_and_replay_are_counted_without_policy_feedback() {
    let mut engine = Engine::new();
    let (wire, _, _) = request(&mut engine, 1, false);
    // Cancel and replay the unchanged physical filter, then receive an empty page.
    engine.network.close_group(RELAY, &wire);
    engine.network.tick(NOW + 220);
    let wire = engine
        .network
        .drain_effects()
        .into_iter()
        .find_map(|effect| match effect {
            Effect::Send(_, frame) => {
                let v: Value = serde_json::from_str(&frame).ok()?;
                (v[0] == "REQ").then(|| v[1].as_str().expect("wire").to_owned())
            }
            _ => None,
        })
        .expect("replay");
    engine
        .network
        .message(RELAY, &json!(["EOSE", wire]).to_string(), NOW + 230);
    engine.network.fetches.inspect(|l| {
        let t = &l.totals[&ResourceClass::Notes];
        assert_eq!(t.replays, 1);
        assert_eq!(t.zero_yield_eose, 1);
    });
}

#[test]
fn private_kind_not_observed() {
    for kind in [4, 13, 14, 1059, 10050] {
        assert_eq!(ResourceClass::event(kind), None);
    }
}
