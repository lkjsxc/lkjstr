use lkjstr_core::store::{Inserted, Query, Store};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};

type Result = std::result::Result<(), Box<dyn std::error::Error>>;

fn events(kind: u64, at: u64, contents: &[&str]) -> Vec<NostrEvent> {
    let secret = generate_secret_key();
    contents
        .iter()
        .filter_map(|content| {
            finalize_event(
                &EventTemplate {
                    pubkey: None,
                    kind,
                    created_at: at,
                    tags: vec![],
                    content: (*content).into(),
                },
                &secret,
            )
            .ok()
        })
        .collect()
}

#[test]
fn deletion_before_target_checks_author_and_keeps_multiple_claimants() -> Result {
    let owner = generate_secret_key();
    let attacker = generate_secret_key();
    let sign = |secret, kind, tags| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: 10,
                kind,
                tags,
                content: "target".into(),
            },
            secret,
        )
        .map_err(|_| "sign regression event")
    };
    let target = sign(&owner, 1, vec![])?;
    let tags = vec![vec!["e".into(), target.id.clone()]];
    let forged = sign(&attacker, 5, tags.clone())?;
    let deletion = sign(&owner, 5, tags)?;
    let mut store = Store::new(10);
    store.insert(forged.clone(), None);
    assert_eq!(store.insert(target.clone(), None), Inserted::New);
    let mut before = Store::new(10);
    before.insert(forged, None);
    before.insert(deletion.clone(), None);
    assert_eq!(
        before.insert(target.clone(), Some("wss://late")),
        Inserted::Deleted
    );
    assert!(before.seen_on(&target.id).is_empty());
    store.insert(deletion, None);
    assert!(store.get(&target.id).is_none());
    assert_eq!(store.insert(target, None), Inserted::Deleted);
    Ok(())
}

#[test]
fn replaceable_ties_choose_lowest_id_in_both_arrival_orders() -> Result {
    for kind in [0, 3, 10002] {
        let mut pair = events(kind, 10, &["a", "b"]);
        pair.sort_by(|a, b| a.id.cmp(&b.id));
        let low = pair.first().ok_or("sign low")?;
        let high = pair.get(1).ok_or("sign high")?;
        for order in [[low, high], [high, low]] {
            let mut store = Store::new(10);
            for event in order {
                store.insert(event.clone(), Some("wss://tie"));
            }
            assert_eq!(
                store.replaceable(&low.pubkey, kind).map(|e| e.id.clone()),
                Some(low.id.clone())
            );
            assert_eq!(store.len(), 1);
            assert!(store.seen_on(&high.id).is_empty());
        }
    }
    Ok(())
}

#[test]
fn metadata_and_notes_have_independent_bounds_and_indexes_are_released() -> Result {
    let mut store = Store::with_caps(2, 2);
    let old = events(0, 1, &[r#"{"name":"old profile"}"#])
        .pop()
        .ok_or("profile")?;
    store.insert(old.clone(), Some("wss://a"));
    for at in 2..12 {
        let mut event = events(0, at, &[r#"{"name":"new profile"}"#])
            .pop()
            .ok_or("metadata")?;
        event.tags = vec![
            vec!["p".into(), old.pubkey.clone()],
            vec!["e".into(), old.id.clone()],
        ];
        store.insert(event, Some("wss://a"));
    }
    assert_eq!(store.len(), 2);
    assert!(store.profile(&old.pubkey).is_none());
    assert!(store.replaceable(&old.pubkey, 0).is_none());
    assert!(store.search_people("old profile", 10).is_empty());
    assert!(store.seen_on(&old.id).is_empty());
    assert_eq!(store.referencing(&old.id).len(), 2);
    assert_eq!(
        store
            .feed(&Query {
                mention: Some(old.pubkey.clone()),
                limit: 100,
                ..Query::default()
            })
            .len(),
        2
    );
    let mut notes = Vec::new();
    for at in 20..23 {
        let event = events(1, at, &["note"]).pop().ok_or("note")?;
        notes.push(event.id.clone());
        store.insert(event, None);
    }
    assert_eq!(store.len(), 4);
    assert!(store.get(&notes[0]).is_none());
    assert!(store.get(&notes[2]).is_some());
    // A deleted replaceable must also disappear from derived metadata.
    let victim = store
        .newest(10)
        .into_iter()
        .find(|e| e.kind == 0)
        .ok_or("victim")?;
    let mut deletion = events(5, 30, &[""]).pop().ok_or("deletion")?;
    deletion.pubkey = victim.pubkey.clone();
    deletion.tags = vec![vec!["e".into(), victim.id.clone()]];
    store.insert(deletion, None);
    assert!(store.profile(&victim.pubkey).is_none());
    assert!(store.replaceable(&victim.pubkey, 0).is_none());
    Ok(())
}
