use super::*;
use crate::engine::{Engine, protocol};
use lkjstr_nips::{event::UnsignedEvent, keys::SecretKey};
use serde_json::{Value, json};
use std::collections::BTreeSet;
type Result = std::result::Result<(), Box<dyn std::error::Error>>;
fn input(engine: &mut Engine, session: &mut Session, value: Value) -> Result {
    for input in session
        .input(serde_json::from_value(value)?, engine)
        .map_err(|(_, e)| e)?
    {
        engine.input(input, 100_000);
    }
    Ok(())
}
#[test]
fn private_row_anchor_is_revoked_before_timeline_output_and_cannot_replay() -> Result {
    let mut engine = Engine::new();
    let mut session = Session::default();
    let mut accounts = vec![];
    let mut public_event_key = String::new();
    for _ in 0..2 {
        let key = SecretKey::from_bytes(*lkjstr_protocol::generate_secret_key().as_bytes())?;
        let event = UnsignedEvent::new(
            key.public_key(),
            100,
            10000,
            vec![vec!["word".into(), "public-word".into()]],
            "encrypted fixture",
        )
        .sign(&key, &[0; 32])?;
        engine.store.insert(
            lkjstr_protocol::parse_nostr_event_json(&event.to_json()?, None)
                .map_err(|_| "fixture")?,
            None,
        );
        engine
            .private_lists
            .insert(event.id, vec![vec!["word".into(), "private-word".into()]]);
        if accounts.is_empty() {
            let note = UnsignedEvent::new(key.public_key(), 99, 1, vec![], "ordinary fixture")
                .sign(&key, &[0; 32])?;
            public_event_key = note.id.clone();
            engine.store.insert(
                lkjstr_protocol::parse_nostr_event_json(&note.to_json()?, None)
                    .map_err(|_| "fixture")?,
                None,
            );
        }
        accounts.push(key.public_key());
    }
    for (sub, account, anchor) in [
        ("revoked", &accounts[0], "mute:word:private-word"),
        ("public", &accounts[0], "mute:word:public-word"),
        ("other", &accounts[1], "mute:word:private-word"),
        ("ordinary", &accounts[0], public_event_key.as_str()),
    ] {
        let query = if sub == "ordinary" {
            json!({"source":"profile","pubkey":account,"account":account})
        } else {
            json!({"source":"mutes","account":account})
        };
        input(
            &mut engine,
            &mut session,
            json!({"t":"open","sub":sub,"query":query}),
        )?;
        let initial = engine
            .drain()
            .into_iter()
            .flat_map(|out| session.output(out, &engine))
            .collect::<Vec<_>>();
        if sub == "revoked" {
            assert!(
                initial
                    .iter()
                    .any(|out| matches!(out, Output::Rows {rows,..}
                if rows.iter().any(|r| r["key"] == anchor)))
            );
        }
        input(
            &mut engine,
            &mut session,
            json!({"t":"window","sub":sub,
            "anchor":{"key":anchor},"before":0,"after":20}),
        )?;
        session.return_keys.insert(sub.into(), anchor.into());
        session.timelines.insert(sub.into(), Default::default());
    }
    let replacement = engine
        .retain_private_accounts(&BTreeSet::from([accounts[1].clone()]), 100_001, false)
        .ok_or("no revocation")?;
    let timelines = session.private_cache_changed(&engine);
    assert!(
        timelines
            .iter()
            .any(|out| matches!(out, Output::Timeline {sub,timeline}
        if sub == "revoked" && timeline.get("anchor").is_none()))
    );
    assert!(engine.views["revoked"].anchor.is_none());
    assert!(session.windows["revoked"].0.is_none());
    assert!(!session.return_keys.contains_key("revoked"));
    for (sub, key) in [
        ("public", "mute:word:public-word"),
        ("other", "mute:word:private-word"),
        ("ordinary", public_event_key.as_str()),
    ] {
        assert_eq!(engine.views[sub].anchor.as_deref(), Some(key));
        assert_eq!(session.windows[sub].0.as_deref(), Some(key));
        assert_eq!(session.return_keys.get(sub).map(String::as_str), Some(key));
    }
    // Transport may retain a window across a Worker replacement after the account is locked.
    input(
        &mut engine,
        &mut session,
        json!({"t":"window","sub":"revoked",
        "anchor":{"key":"mute:word:private-word"},"before":0,"after":20}),
    )?;
    assert!(engine.views["revoked"].anchor.is_none());
    assert!(session.windows["revoked"].0.is_none());
    // A rejected month lookup must not install a revoked private return key first.
    let _ = session.input(
        serde_json::from_value(json!({"t":"window","sub":"revoked",
        "anchor":{"month":0,"offset":0,"returnKey":"mute:word:private-word"},
        "before":0,"after":20}))?,
        &engine,
    );
    assert!(!session.return_keys.contains_key("revoked"));
    for output in replacement {
        if let protocol::Output::Rows { sub, .. } = &output
            && sub == "revoked"
        {
            assert!(
                !serde_json::to_string(&session.output(output, &engine))?.contains("private-word")
            );
        }
    }
    Ok(())
}

#[test]
fn authority_loss_purges_hidden_cache_after_policy_was_already_invalidated() -> Result {
    let mut engine = Engine::new();
    let mut session = Session::default();
    let key = SecretKey::from_bytes(*lkjstr_protocol::generate_secret_key().as_bytes())?;
    let event = UnsignedEvent::new(
        key.public_key(),
        100,
        10000,
        vec![vec!["word".into(), "still-public".into()]],
        "encrypted fixture",
    )
    .sign(&key, &[0; 32])?;
    engine.store.insert(
        lkjstr_protocol::parse_nostr_event_json(&event.to_json()?, None).map_err(|_| "fixture")?,
        None,
    );
    engine
        .private_lists
        .insert(event.id, vec![vec!["word".into(), "old-private".into()]]);
    input(
        &mut engine,
        &mut session,
        json!({"t":"open","sub":"held",
        "query":{"source":"mutes","account":key.public_key()}}),
    )?;
    input(
        &mut engine,
        &mut session,
        json!({"t":"window","sub":"held",
        "anchor":{"key":"mute:word:old-private"},"before":0,"after":20}),
    )?;
    for output in engine.drain() {
        session.output(output, &engine);
    }
    input(
        &mut engine,
        &mut session,
        json!({"t":"hint","hint":{
        "visibleSubs":[],"pageHidden":false,"idle":false,"saveData":false}}),
    )?;
    // accounts::status replaces policy and invalidates views, but hidden rows do not render.
    engine.private_lists.clear();
    engine.invalidate();
    assert!(serde_json::to_string(&session.delivered)?.contains("old-private"));
    let outputs = engine
        .retain_private_accounts(&BTreeSet::new(), 100_001, true)
        .ok_or("authority loss skipped the stale hidden cache")?;
    session.private_cache_changed(&engine);
    let replacement = outputs
        .into_iter()
        .flat_map(|out| session.output(out, &engine))
        .collect::<Vec<_>>();
    assert!(!serde_json::to_string(&replacement)?.contains("old-private"));
    assert!(!serde_json::to_string(&session.delivered)?.contains("old-private"));
    assert!(serde_json::to_string(&session.delivered)?.contains("still-public"));
    assert!(engine.views["held"].anchor.is_none());
    assert!(session.windows["held"].0.is_none());
    Ok(())
}
