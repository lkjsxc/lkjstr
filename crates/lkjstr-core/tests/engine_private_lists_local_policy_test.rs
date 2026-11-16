//! Saved-account notification policy owns local mutes without an open feed.
pub mod private_lists_support;
use private_lists_support::{Fixture, Result};
#[test]
fn unlocked_local_mutes_are_demanded_without_any_open_view() -> Result {
    let mut f = Fixture::new()?;
    let id = f.list(10000, 100, "private")?;
    let mut available = f.access();
    available.get_mut(&f.account()).ok_or("fixture")?.local = true;
    f.reads.sync(&f.store, available, vec![], 0);
    let job = f.job(0)?;
    assert_eq!(job.event, id);
    assert!(
        f.reads
            .finish(
                &f.store,
                &job,
                Ok("[[\"word\",\"private\"]]".into()),
                1,
                true
            )
            .is_some()
    );
    f.reads.sync(
        &f.store,
        {
            let mut a = f.access();
            a.get_mut(&f.account()).ok_or("fixture")?.local = true;
            a
        },
        vec![],
        2,
    );
    assert!(f.reads.next(&f.store, 2).is_none());
    Ok(())
}
#[test]
fn external_locked_and_readonly_accounts_never_get_background_crypto() -> Result {
    for (local, error) in [
        (false, None),
        (true, Some("signer-missing")),
        (false, Some("read-only")),
    ] {
        let mut f = Fixture::new()?;
        let id = f.list(10000, 100, "private")?;
        let mut available = f.access();
        let access = available.get_mut(&f.account()).ok_or("fixture")?;
        access.local = local;
        access.error = error;
        f.reads.sync(&f.store, available, vec![], 0);
        assert!(f.reads.next(&f.store, 0).is_none());
        assert_ne!(f.reads.status(&f.account(), &[id]).phase, "ready");
    }
    Ok(())
}
#[test]
fn background_mutes_do_not_admit_private_memberships_without_a_view() -> Result {
    let mut f = Fixture::new()?;
    let mute = f.list(10000, 100, "mute")?;
    f.list(10003, 100, "bookmarks")?;
    f.list(30000, 100, "people")?;
    let mut available = f.access();
    available.get_mut(&f.account()).ok_or("fixture")?.local = true;
    f.reads.sync(&f.store, available, vec![], 0);
    let job = f.job(0)?;
    assert_eq!(job.event, mute);
    f.reads.finish(&f.store, &job, Ok("[]".into()), 1, true);
    assert!(f.reads.next(&f.store, 2).is_none());
    Ok(())
}
#[test]
fn another_active_account_does_not_remove_the_local_notification_mute_policy() -> Result {
    use lkjstr_core::engine::{Engine, accounts::Accounts, wire::unread_count};
    use lkjstr_nips::event::UnsignedEvent;
    let mut a = Fixture::new()?;
    let muted = a.list(10000, 100, "private")?;
    let b = Fixture::new()?;
    let account = a.account();
    let mut accounts = Accounts::default();
    for key in [&a.key, &b.key] {
        let text = lkjstr_protocol::encode_nsec(&lkjstr_protocol::bytes_to_hex(key.as_bytes()))
            .map_err(|_| "fixture nsec")?;
        accounts.add("key", Some(&text))?;
    }
    assert_eq!(accounts.active.as_deref(), Some(b.account().as_str()));
    let mention = UnsignedEvent::new(
        b.account(),
        101,
        1,
        vec![vec!["p".into(), account.clone()]],
        "private",
    )
    .sign(&b.key, &[4; 32])?;
    a.store.insert(
        lkjstr_protocol::parse_nostr_event_json(&mention.to_json()?, None)
            .map_err(|_| "fixture parse")?,
        None,
    );
    let available = accounts
        .entries
        .iter()
        .map(|entry| {
            (
                entry.pubkey.clone(),
                lkjstr_core::engine::private_lists::Access {
                    authority: entry.authority(),
                    local: true,
                    error: None,
                },
            )
        })
        .collect();
    let mut engine = Engine::new();
    engine.store = a.store;
    assert_eq!(unread_count(&engine, &account), 1);
    engine
        .private_reads
        .sync(&engine.store, available, vec![], 0);
    let job = engine
        .private_reads
        .next_local_mute(&engine.store, 0)
        .ok_or("background local mute")?;
    assert_eq!(job.event, muted);
    let event = engine.store.get(&muted).ok_or("fixture event")?;
    let text = accounts
        .crypt(
            &account,
            &account,
            job.format.operation(),
            &event.content,
            &[0; 32],
        )?
        .ok_or("local crypto")?;
    let tags = engine
        .private_reads
        .finish(&engine.store, &job, Ok(text), 1, false)
        .ok_or("decrypted tags")?;
    engine.private_lists.insert(muted, tags);
    assert_eq!(unread_count(&engine, &account), 0);
    assert_eq!(
        engine
            .private_reads
            .policy_status(&engine.store, &account)
            .phase,
        "ready"
    );
    assert!(
        engine
            .private_reads
            .next_local_mute(&engine.store, 2)
            .is_none()
    );
    Ok(())
}
#[test]
fn account_dependency_distinguishes_unknown_from_queued_and_unavailable() -> Result {
    let mut f = Fixture::new()?;
    let id = f.list(10000, 100, "private")?;
    f.reads.sync(&f.store, f.access(), vec![], 0);
    assert_eq!(
        f.reads.policy_status(&f.store, &f.account()).phase,
        "unknown"
    );
    f.sync(std::slice::from_ref(&id), 1);
    assert_eq!(
        f.reads.policy_status(&f.store, &f.account()).phase,
        "loading"
    );
    let job = f.job(1)?;
    f.reads
        .finish(&f.store, &job, Err("signer-refused"), 2, true);
    assert_eq!(
        f.reads.policy_status(&f.store, &f.account()).phase,
        "failed"
    );
    for (error, phase) in [("read-only", "unsupported"), ("signer-missing", "unknown")] {
        let mut a = f.access();
        a.get_mut(&f.account()).ok_or("fixture")?.error = Some(error);
        f.reads.sync(&f.store, a, vec![], 3);
        assert_eq!(f.reads.policy_status(&f.store, &f.account()).phase, phase);
        assert!(f.reads.next(&f.store, 4).is_none());
    }
    Ok(())
}
