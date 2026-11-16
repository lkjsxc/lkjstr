//! Cached successes and failures are tied to signed IDs, not public Store revisions.
mod private_lists_support;
use lkjstr_core::engine::private_lists::MAX_RECORDS;
use private_lists_support::{Fixture, Result};
#[test]
fn twenty_thousand_unrelated_insertions_never_repeat_successful_crypto() -> Result {
    let mut f = Fixture::new()?;
    let id = f.list(10000, 100, "cached")?;
    f.sync(std::slice::from_ref(&id), 0);
    let job = f.job(0)?;
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
    let bytes = f.reads.bytes();
    assert!(bytes > 0);
    // Test-only already-admitted public events; no cryptographic assertion relies on these notes.
    let mut note = (*f.store.get(&id).ok_or("fixture event")?).clone();
    note.kind = 1;
    note.tags.clear();
    note.content = "unrelated public fixture".into();
    let before = f.store.revision();
    for n in 0..20_000 {
        note.id = format!("{n:064x}");
        note.created_at = 200 + n;
        f.store.insert(note.clone(), None);
        f.sync(std::slice::from_ref(&id), 2 + n);
        assert!(f.reads.next(&f.store, 2 + n).is_none());
    }
    assert_eq!(f.store.revision() - before, 20_000);
    assert_eq!(f.reads.len(), 1);
    assert_eq!(f.reads.bytes(), bytes);
    assert_eq!(f.reads.status(&f.account(), &[id]).phase, "ready");
    Ok(())
}
#[test]
fn rejected_plaintext_is_terminal_until_explicit_retry() -> Result {
    let mut f = Fixture::new()?;
    let id = f.list(10000, 100, "invalid")?;
    f.sync(std::slice::from_ref(&id), 0);
    let job = f.job(0)?;
    assert!(
        f.reads
            .finish(&f.store, &job, Ok("not tags".into()), 1, true)
            .is_none()
    );
    for n in 2..200 {
        f.sync(std::slice::from_ref(&id), n);
        assert!(f.reads.next(&f.store, n).is_none());
    }
    assert_eq!(
        f.reads
            .status(&f.account(), std::slice::from_ref(&id))
            .error,
        Some("rejected")
    );
    f.reads.retry(&f.account());
    let retry = f.job(201)?;
    assert_ne!(job.token, retry.token);
    assert!(
        f.reads
            .finish(&f.store, &job, Ok("[]".into()), 202, true)
            .is_none()
    );
    assert!(
        f.reads
            .finish(&f.store, &retry, Ok("[]".into()), 202, true)
            .is_some()
    );
    Ok(())
}
#[test]
fn refusal_stops_only_this_accounts_other_pending_lists() -> Result {
    let mut f = Fixture::new()?;
    let mute = f.list(10000, 100, "mute")?;
    let marks = f.list(10003, 100, "marks")?;
    let ids = vec![mute.clone(), marks];
    f.sync(&ids, 0);
    let job = f.job(0)?;
    assert_eq!(job.event, mute);
    f.reads
        .finish(&f.store, &job, Err("signer-refused"), 1, true);
    assert!(f.reads.next(&f.store, 2).is_none());
    let status = f.reads.status(&f.account(), &ids);
    assert_eq!(status.failed, 2);
    assert_eq!(status.pending, 0);
    assert_eq!(status.error, Some("signer-refused"));
    f.reads.retry(&f.account());
    assert!(f.reads.next(&f.store, 3).is_some());
    Ok(())
}
#[test]
fn unsupported_algorithm_does_not_block_the_other_read_algorithm() -> Result {
    let mut f = Fixture::new()?;
    let current = f.list(10000, 100, "44")?;
    let historical = f.envelope(
        10003,
        100,
        "04",
        "AAAAAAAAAAAAAAAAAAAAAA==?iv=AQEBAQEBAQEBAQEBAQEBAQ==".into(),
    )?;
    f.sync(&[current.clone(), historical.clone()], 0);
    let job = f.job(0)?;
    assert_eq!(job.event, current);
    f.reads.finish(&f.store, &job, Err("unsupported"), 1, true);
    let next = f.job(2)?;
    assert_eq!(next.event, historical);
    assert_eq!(next.format.operation(), "nip04.decrypt");
    assert!(
        f.reads
            .finish(&f.store, &next, Ok("[]".into()), 3, true)
            .is_some()
    );
    assert_eq!(
        f.reads.status(&f.account(), &[current]).phase,
        "unsupported"
    );
    assert_eq!(f.reads.status(&f.account(), &[historical]).phase, "ready");
    Ok(())
}
#[test]
fn record_bound_is_explicit_and_never_discards_an_owned_success() -> Result {
    let mut f = Fixture::new()?;
    for n in 0..MAX_RECORDS {
        let id = f.list(30000, 100, &format!("set-{n}"))?;
        f.sync(std::slice::from_ref(&id), n as u64 * 2);
        let job = f.job(n as u64 * 2)?;
        assert!(
            f.reads
                .finish(&f.store, &job, Ok("[]".into()), n as u64 * 2 + 1, true)
                .is_some()
        );
    }
    let overflow = f.list(30000, 100, "overflow")?;
    f.sync(std::slice::from_ref(&overflow), 1_000);
    assert!(f.reads.next(&f.store, 1_000).is_none());
    assert_eq!(f.reads.len(), MAX_RECORDS);
    assert_eq!(
        f.reads.status(&f.account(), &[overflow]).error,
        Some("too-large")
    );
    Ok(())
}
