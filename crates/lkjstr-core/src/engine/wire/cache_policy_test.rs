use super::*;
use crate::engine::{Engine, protocol as p, wire::queries};
use lkjstr_nips::{event::UnsignedEvent, keys::SecretKey};
use serde_json::json;

type Result = std::result::Result<(), Box<dyn std::error::Error>>;

fn outputs(session: &mut Session, engine: &Engine) -> Vec<Output> {
    session.output(
        p::Output::Rows {
            sub: "view".into(),
            items: vec![],
            at_top: true,
            at_bottom: false,
        },
        engine,
    )
}
fn allowed(output: &[Output]) -> Option<bool> {
    output.iter().find_map(|value| match value {
        Output::CachePolicy { allow, .. } => Some(*allow),
        _ => None,
    })
}

#[test]
fn public_projection_permission_is_bounded_to_owned_supported_queries() {
    let engine = Engine::new();
    let mut session = Session::default();
    assert_eq!(allowed(&outputs(&mut session, &engine)), None);
    session.queries.insert(
        "view".into(),
        queries::Query {
            source: "global".into(),
            ..Default::default()
        },
    );
    assert_eq!(allowed(&outputs(&mut session, &engine)), Some(true));
    assert_eq!(allowed(&outputs(&mut session, &engine)), None);
    if let Some(query) = session.queries.get_mut("view") {
        query.source = "diagnostics".into();
    }
    assert_eq!(allowed(&outputs(&mut session, &engine)), Some(false));
}

#[test]
fn public_note_bodies_do_not_authorize_private_list_membership() -> Result {
    let mut engine = Engine::new();
    let key = SecretKey::from_bytes(*lkjstr_protocol::generate_secret_key().as_bytes())?;
    let event = UnsignedEvent::new(key.public_key(), 100, 10000, vec![], "ciphertext fixture")
        .sign(&key, &[0; 32])?;
    let id = event.id.clone();
    engine.store.insert(
        lkjstr_protocol::parse_nostr_event_json(&event.to_json()?, None).map_err(|_| "fixture")?,
        None,
    );
    engine.private_lists.insert(
        id.clone(),
        vec![vec!["word".into(), "private membership".into()]],
    );
    for source in [
        "home",
        "profile",
        "notifications",
        "bookmarks",
        "mutes",
        "list",
        "channel",
    ] {
        let mut session = Session::default();
        session.queries.insert(
            "view".into(),
            queries::Query {
                source: source.into(),
                account: Some(key.public_key()),
                ..Default::default()
            },
        );
        assert_eq!(allowed(&outputs(&mut session, &engine)), Some(false));
        engine.private_lists.clear();
        assert_eq!(allowed(&outputs(&mut session, &engine)), Some(true));
        engine.private_lists.insert(
            id.clone(),
            vec![vec!["word".into(), "private membership".into()]],
        );
        assert_eq!(allowed(&outputs(&mut session, &engine)), Some(false));
    }
    let mut other = Session::default();
    other.queries.insert(
        "view".into(),
        queries::Query {
            source: "global".into(),
            account: Some("f".repeat(64)),
            ..Default::default()
        },
    );
    assert_eq!(allowed(&outputs(&mut other, &engine)), Some(true));
    Ok(())
}

#[test]
fn close_releases_permission_before_subscription_identity_reuse() -> Result {
    let engine = Engine::new();
    let mut session = Session::default();
    session.queries.insert(
        "view".into(),
        queries::Query {
            source: "global".into(),
            ..Default::default()
        },
    );
    assert_eq!(allowed(&outputs(&mut session, &engine)), Some(true));
    session
        .input(
            serde_json::from_value(json!({"t":"close","sub":"view"}))?,
            &engine,
        )
        .map_err(|(_, error)| error)?;
    assert!(session.cache_policies.is_empty());
    Ok(())
}
