//! Read ownership is checked again after every asynchronous boundary.
mod private_lists_support;
use private_lists_support::{Fixture, Result};
use std::collections::BTreeMap;
#[test]
fn hide_reopen_same_subscription_consumes_old_identity() -> Result {
    let mut f = Fixture::new()?;
    let id = f.list(10000, 100, "hidden")?;
    f.sync(std::slice::from_ref(&id), 0);
    let old = f.job(0)?;
    f.reads.sync(&f.store, f.access(), vec![], 1);
    f.sync(std::slice::from_ref(&id), 2);
    let next = f.job(2)?;
    assert_ne!(old.token, next.token);
    assert!(
        f.reads
            .finish(&f.store, &old, Ok("[[\"word\",\"late\"]]".into()), 3, true)
            .is_none()
    );
    assert!(f.reads.current(&next, 3));
    assert_eq!(
        f.reads.finish(
            &f.store,
            &next,
            Ok("[[\"word\",\"current\"]]".into()),
            3,
            true
        ),
        Some(vec![vec!["word".into(), "current".into()]])
    );
    Ok(())
}
#[test]
fn replacement_retires_success_and_rejects_old_inflight_completion() -> Result {
    let mut f = Fixture::new()?;
    let old = f.list(10003, 100, "old")?;
    f.sync(std::slice::from_ref(&old), 0);
    let job = f.job(0)?;
    let new = f.list(10003, 101, "new")?;
    assert!(
        f.reads
            .finish(&f.store, &job, Ok("[]".into()), 1, true)
            .is_none()
    );
    let removed = f.reads.sync(
        &f.store,
        f.access(),
        vec![f.demand(std::slice::from_ref(&new))],
        2,
    );
    assert_eq!(removed, vec![old]);
    let fresh = f.job(2)?;
    assert_eq!(fresh.event, new);
    assert_ne!(fresh.token, job.token);
    assert!(
        f.reads
            .finish(&f.store, &fresh, Ok("[]".into()), 3, true)
            .is_some()
    );
    let replacement = f.list(10003, 102, "third")?;
    let removed = f
        .reads
        .sync(&f.store, f.access(), vec![f.demand(&[replacement])], 4);
    assert_eq!(removed, vec![new]);
    assert_eq!(f.reads.bytes(), 0);
    Ok(())
}
#[test]
fn lock_remove_readd_and_clear_never_reuse_authority_or_job_tokens() -> Result {
    let mut f = Fixture::new()?;
    let id = f.list(10000, 100, "revoke")?;
    f.sync(std::slice::from_ref(&id), 0);
    let old = f.job(0)?;
    let mut locked = f.access();
    locked
        .get_mut(&f.account())
        .ok_or("fixture authority")?
        .error = Some("signer-missing");
    assert_eq!(
        f.reads.sync(
            &f.store,
            locked,
            vec![f.demand(std::slice::from_ref(&id))],
            1
        ),
        vec![id.clone()]
    );
    assert!(
        f.reads
            .finish(&f.store, &old, Ok("[]".into()), 2, true)
            .is_none()
    );
    f.sync(std::slice::from_ref(&id), 3);
    let unlocked = f.job(3)?;
    assert_ne!(old.epoch, unlocked.epoch);
    f.reads.sync(&f.store, BTreeMap::new(), vec![], 4);
    f.sync(std::slice::from_ref(&id), 5);
    let readded = f.job(5)?;
    assert_ne!(unlocked.epoch, readded.epoch);
    f.reads.clear();
    f.sync(std::slice::from_ref(&id), 6);
    let cleared = f.job(6)?;
    assert_ne!(cleared.token, readded.token);
    assert!(
        f.reads
            .finish(&f.store, &readded, Ok("[]".into()), 7, true)
            .is_none()
    );
    assert!(f.reads.current(&cleared, 7));
    Ok(())
}
#[test]
fn client_detach_and_external_opt_out_cancel_without_refusal_latch() -> Result {
    let mut f = Fixture::new()?;
    let id = f.list(10000, 100, "client")?;
    f.sync(std::slice::from_ref(&id), 0);
    let old = f.job(0)?;
    let mut other = f.demand(std::slice::from_ref(&id));
    other.client = 2;
    f.reads.sync(&f.store, f.access(), vec![other], 1);
    let current = f.job(1)?;
    assert_eq!(current.client, 2);
    assert!(
        f.reads
            .finish(&f.store, &old, Err("signer-refused"), 2, true)
            .is_none()
    );
    assert!(f.reads.current(&current, 2));
    let mut optout = f.demand(std::slice::from_ref(&id));
    optout.external = false;
    f.reads.sync(&f.store, f.access(), vec![optout.clone()], 3);
    assert!(f.reads.next(&f.store, 3).is_none());
    let mut local = f.access();
    local.get_mut(&f.account()).ok_or("fixture")?.local = true;
    f.reads.sync(&f.store, local, vec![optout], 4);
    assert!(f.reads.next(&f.store, 4).is_some());
    Ok(())
}
