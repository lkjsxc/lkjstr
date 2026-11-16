//! An ordinary hidden open cannot create private work between open and its hint.
use lkjstr_core::engine::{
    Engine,
    private_lists::Access,
    protocol as p,
    wire::{Input, Output, Session},
};
use lkjstr_nips::{event::UnsignedEvent, keys::SecretKey, list_crypto};
use serde_json::{Value, json};
use std::collections::BTreeSet;
type Result<T = ()> = std::result::Result<T, Box<dyn std::error::Error>>;
fn fixture() -> Result<(Engine, Session, String, String)> {
    let key = SecretKey::from_bytes(*lkjstr_protocol::generate_secret_key().as_bytes())?;
    let event = UnsignedEvent::new(
        key.public_key(),
        100,
        10000,
        vec![],
        list_crypto::encrypt(&[vec!["word".into(), "private".into()]], &key, &[5; 32])?,
    )
    .sign(&key, &[0; 32])?;
    let mut e = Engine::new();
    e.store.insert(
        lkjstr_protocol::parse_nostr_event_json(&event.to_json()?, None)
            .map_err(|_| "fixture parse")?,
        None,
    );
    Ok((e, Session::default(), key.public_key(), event.id))
}
fn input(s: &mut Session, e: &mut Engine, value: Value) -> Result<Vec<p::Input>> {
    let inputs = s
        .input(serde_json::from_value::<Input>(value)?, e)
        .map_err(|(_, code)| code)?;
    Ok(inputs)
}
fn private_state(outputs: Vec<Output>) -> Option<Value> {
    outputs.into_iter().find_map(|out| match out {
        Output::State { state, .. } => state.get("privateLists").cloned(),
        _ => None,
    })
}
#[test]
fn opt_in_and_initial_visibility_are_both_required_for_external_reads() -> Result {
    let (mut e, mut s, account, id) = fixture()?;
    for (sub, optin, visible) in [("old", false, true), ("hidden", true, false)] {
        let inputs = input(
            &mut s,
            &mut e,
            json!({"t":"open","sub":sub,"visible":visible,
            "query":{"source":"mutes","account":account,"privateLists":optin}}),
        )?;
        assert!(matches!(inputs.first(),Some(p::Input::OpenVisible{visible:v,..}) if *v==visible));
        for i in inputs {
            e.input(i, 100_000);
        }
    }
    assert!(s.private_demands(1, &e, &BTreeSet::new()).is_empty());
    let inputs = input(
        &mut s,
        &mut e,
        json!({"t":"hint","hint":{"visibleSubs":["hidden"],
        "pageHidden":false,"idle":false,"saveData":false}}),
    )?;
    for i in inputs {
        e.input(i, 100_001);
    }
    let demands = s.private_demands(1, &e, &BTreeSet::new());
    assert_eq!(demands.len(), 1);
    assert_eq!(demands[0].sub, "hidden");
    assert_eq!(demands[0].events, vec![id]);
    input(
        &mut s,
        &mut e,
        json!({"t":"hint","hint":{"visibleSubs":["hidden"],
        "pageHidden":true,"idle":false,"saveData":false}}),
    )?;
    assert!(s.private_demands(1, &e, &BTreeSet::new()).is_empty());
    Ok(())
}
#[test]
fn completion_without_public_store_change_emits_truthful_private_state() -> Result {
    let (mut e, mut s, account, id) = fixture()?;
    for i in input(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"list","visible":true,
        "query":{"source":"mutes","account":account,"privateLists":true}}),
    )? {
        e.input(i, 100_000);
    }
    let demand = s.private_demands(1, &e, &BTreeSet::new());
    e.private_reads.sync(
        &e.store,
        [(
            account.clone(),
            Access {
                authority: 1,
                local: false,
                error: None,
            },
        )]
        .into(),
        demand,
        0,
    );
    let state = private_state(s.private_tick(&e)).ok_or("private state")?;
    assert_eq!(state["phase"], "loading");
    assert_eq!(state["pending"], 1);
    let revision = e.store.revision();
    let job = e.private_reads.next(&e.store, 0).ok_or("read job")?;
    e.private_reads
        .finish(&e.store, &job, Err("signer-refused"), 1, true);
    let state = private_state(s.private_tick(&e)).ok_or("failure state")?;
    assert_eq!(state["phase"], "failed");
    assert_eq!(state["error"], "signer-refused");
    assert_eq!(e.store.revision(), revision);
    assert!(s.private_tick(&e).is_empty());
    e.private_reads.retry(&account);
    let job = e.private_reads.next(&e.store, 2).ok_or("retry job")?;
    e.private_reads
        .finish(&e.store, &job, Ok("[]".into()), 3, true);
    assert_eq!(
        private_state(s.private_tick(&e)).ok_or("ready")?["phase"],
        "ready"
    );
    assert_eq!(e.private_reads.status(&account, &[id]).failed, 0);
    Ok(())
}
#[test]
fn foreign_named_sets_never_enter_another_accounts_demand() -> Result {
    let (mut e, mut s, account, id) = fixture()?;
    let other = SecretKey::from_bytes(*lkjstr_protocol::generate_secret_key().as_bytes())?;
    let event = UnsignedEvent::new(
        other.public_key(),
        100,
        30000,
        vec![vec!["d".into(), "set".into()]],
        list_crypto::encrypt(&[vec!["p".into(), other.public_key()]], &other, &[8; 32])?,
    )
    .sign(&other, &[0; 32])?;
    e.store.insert(
        lkjstr_protocol::parse_nostr_event_json(&event.to_json()?, None)
            .map_err(|_| "fixture parse")?,
        None,
    );
    input(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"list","query":{
        "source":"list","account":account,"tag":format!("30000:{}:set",other.public_key()),"privateLists":true}}),
    )?;
    let demands = s.private_demands(1, &e, &BTreeSet::new());
    assert_eq!(demands.len(), 1);
    assert_eq!(demands[0].events, vec![id]);
    assert!(!demands[0].events.contains(&event.id));
    Ok(())
}
