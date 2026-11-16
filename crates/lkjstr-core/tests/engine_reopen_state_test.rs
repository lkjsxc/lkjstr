#![allow(clippy::unwrap_used, clippy::expect_used)]
// Reopening a logical view must observe completion independently of retained relay work.
mod engine_review_support;
use engine_review_support::{RELAY, accept, output};
use lkjstr_core::engine::{Engine, network::Effect, private_lists::Access, protocol, wire};
use lkjstr_nips::{event::UnsignedEvent, keys::SecretKey, list_crypto};
use serde_json::{Value, json};
use std::collections::BTreeSet;

struct Fixture {
    engine: Engine,
    session: wire::Session,
    account: String,
    now: u64,
}
impl Fixture {
    fn new() -> Self {
        let mut engine = Engine::new();
        let key = SecretKey::from_bytes([21; 32]).unwrap();
        let account = key.public_key();
        for kind in [10000, 10003] {
            let event = UnsignedEvent::new(
                account.clone(),
                100,
                kind,
                vec![],
                list_crypto::encrypt(&[], &key, &[kind as u8; 32]).unwrap(),
            )
            .sign(&key, &[42; 32])
            .unwrap();
            engine.store.insert(
                serde_json::from_value(serde_json::to_value(event).unwrap()).unwrap(),
                None,
            );
        }
        engine.input(
            protocol::Input::Configure {
                relays: vec![RELAY.into()],
            },
            200_000,
        );
        Self {
            engine,
            session: Default::default(),
            account,
            now: 200_000,
        }
    }
    fn open(&mut self, source: &str) {
        accept(
            &mut self.session,
            &mut self.engine,
            json!({
                "t":"open","sub":"list","query":{
                    "source":source,"account":self.account,"privateLists":true
                }
            }),
            self.now,
        );
        self.sync();
    }
    fn sync(&mut self) {
        self.engine.private_reads.sync(
            &self.engine.store,
            [(
                self.account.clone(),
                Access {
                    authority: 1,
                    local: false,
                    error: None,
                },
            )]
            .into(),
            self.session
                .private_demands(1, &self.engine, &BTreeSet::new()),
            self.now,
        );
    }
    fn network(&mut self) {
        for _ in 0..24 {
            self.now += 100;
            for effect in self.engine.network.drain_effects() {
                match effect {
                    Effect::Connect(relay) => self.engine.network.connected(&relay, self.now),
                    Effect::Send(relay, text) => {
                        let frame: Value = serde_json::from_str(&text).unwrap();
                        if frame[0] == "REQ" {
                            self.engine.network.message(
                                &relay,
                                &json!(["EOSE", frame[1]]).to_string(),
                                self.now,
                            );
                        }
                    }
                    _ => {}
                }
            }
            self.engine.tick(self.now);
        }
    }
    fn output(&mut self) -> Vec<Value> {
        output(&mut self.session, &mut self.engine)
    }
    fn private(&mut self, ok: bool) -> Vec<Value> {
        while let Some(job) = self.engine.private_reads.next(&self.engine.store, self.now) {
            self.engine.private_reads.finish(
                &self.engine.store,
                &job,
                if ok {
                    Ok("[]".into())
                } else {
                    Err("signer-refused")
                },
                self.now,
                true,
            );
            if !ok {
                break;
            }
        }
        self.session
            .private_tick(&self.engine)
            .into_iter()
            .map(|out| serde_json::to_value(out).unwrap())
            .collect()
    }
}
fn state(messages: &[Value]) -> Option<&Value> {
    messages
        .iter()
        .rev()
        .find(|m| m["t"] == "state" && m["sub"] == "list")
        .map(|m| &m["state"])
}
fn replace(close: bool, source: &str) {
    let mut f = Fixture::new();
    f.open("mutes");
    f.network();
    let initial = f.output();
    let observed = state(&initial).expect("initial relay completion");
    assert_eq!(observed["privateLists"]["phase"], "loading");
    assert_eq!(
        state(&f.private(false)).unwrap()["privateLists"]["phase"],
        "failed"
    );
    f.engine.private_reads.retry(&f.account);
    if close {
        accept(
            &mut f.session,
            &mut f.engine,
            json!({"t":"close","sub":"list"}),
            f.now,
        );
        f.output();
    }
    f.open(source);
    assert!(
        f.session.private_tick(&f.engine).is_empty(),
        "new query cannot borrow the old query's phase"
    );
    f.network();
    let replacement = f.output();
    let current = state(&replacement).expect("new Open observes current relay completion");
    assert_eq!(current["relaysAsked"], observed["relaysAsked"]);
    assert_eq!(current["relaysAnswered"], observed["relaysAnswered"]);
    assert_eq!(current["privateLists"]["phase"], "loading");
    let completed = f.private(true);
    let final_state = state(&completed).expect("private completion retains its current relay base");
    assert_eq!(final_state["phase"], current["phase"]);
    assert_eq!(final_state["privateLists"]["phase"], "ready");
    assert!(f.session.private_tick(&f.engine).is_empty());
}
#[test]
fn replacing_the_same_query_observes_completed_relay_work_again() {
    replace(false, "mutes");
}
#[test]
fn replacing_with_a_new_query_observes_its_own_identical_relay_counts() {
    replace(false, "bookmarks");
}
#[test]
fn close_reopen_same_query_keeps_dependency_completion_truthful() {
    replace(true, "mutes");
}
#[test]
fn close_reopen_new_query_keeps_dependency_completion_truthful() {
    replace(true, "bookmarks");
}
#[test]
fn replacement_discards_an_undelivered_previous_query_state() {
    let mut f = Fixture::new();
    f.open("mutes");
    f.network(); // Deliberately leave the first query's terminal Status queued.
    f.open("bookmarks");
    assert!(
        state(&f.output()).is_none(),
        "a queued Status from the previous logical Open cannot seed the new query"
    );
    f.network();
    assert!(
        state(&f.output()).is_some(),
        "the new query still receives its own result"
    );
}
