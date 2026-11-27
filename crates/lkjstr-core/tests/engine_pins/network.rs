#![allow(dead_code, clippy::expect_used)]
use super::support::*;
use lkjstr_core::engine::{Engine, wire::Session};
use lkjstr_protocol::NostrEvent;
use serde_json::{Value, json};

pub struct Fixture {
    pub engine: Engine,
    pub session: Session,
    pub note: NostrEvent,
    pub owner: String,
    pub list_request: Value,
    pub note_request: Value,
    pub outputs: Vec<Value>,
}
pub fn pending() -> Fixture {
    let mut engine = Engine::new();
    configure(&mut engine, &[RELAY]);
    engine
        .network
        .relays
        .get_mut(RELAY)
        .expect("relay")
        .max_reqs = 8;
    let note = event(2, 1, 10, "requested pinned note", vec![]);
    let list = event(1, 10001, 40, "", vec![pin_tag(&note.id)]);
    let owner = list.pubkey.clone();
    let mut session = Session::default();
    accept(
        &mut session,
        &mut engine,
        json!({
            "t":"open","sub":"pins","query":{"source":"pins","pubkey":owner}
        }),
        NOW,
    );
    output(&mut session, &mut engine);
    engine.network.connected(RELAY, NOW + 1);
    engine.tick(NOW + 100);
    let sent = frames(&mut engine);
    let list_request = filter_for(&sent, 10001).clone();
    relay_event(&mut engine, RELAY, &list_request, &list, NOW + 101);
    eose(&mut engine, RELAY, &list_request, NOW + 102);
    engine.tick(NOW + 400);
    let mut outputs = output(&mut session, &mut engine);
    let mut sent = frames(&mut engine);
    engine.tick(NOW + 500);
    outputs.extend(output(&mut session, &mut engine));
    sent.extend(frames(&mut engine));
    let note_request = sent
        .into_iter()
        .find(|frame| {
            frame[0] == "REQ"
                && frame[2]["ids"]
                    .as_array()
                    .is_some_and(|ids| ids.iter().any(|id| id == &note.id))
        })
        .expect("missing pinned body is requested");
    Fixture {
        engine,
        session,
        note,
        owner,
        list_request,
        note_request,
        outputs,
    }
}
pub fn state(outputs: &[Value]) -> &Value {
    &outputs
        .iter()
        .rfind(|out| out["t"] == "state" && out["sub"] == "pins")
        .expect("pins state")["state"]
}
pub fn resolve(fixture: &mut Fixture) -> Vec<Value> {
    relay_event(
        &mut fixture.engine,
        RELAY,
        &fixture.note_request,
        &fixture.note,
        NOW + 600,
    );
    eose(&mut fixture.engine, RELAY, &fixture.note_request, NOW + 601);
    fixture.engine.tick(NOW + 700);
    output(&mut fixture.session, &mut fixture.engine)
}
