#![allow(clippy::expect_used)]
//! Private signer decisions are bounded and consume stale read/call identities.
use lkjstr_core::engine::dm::signers::{Failure, Gate};
use std::collections::{BTreeMap, BTreeSet};
fn available(visible: bool) -> BTreeMap<String, (u64, bool)> {
    [("a".into(), (1, visible)), ("b".into(), (2, true))].into()
}
fn clients() -> BTreeSet<u64> {
    [10, 11].into()
}
fn gate() -> Gate {
    let mut gate = Gate::default();
    gate.sync(&available(true), &clients());
    gate
}
#[test]
fn one_active_call_per_account_and_other_accounts_continue() {
    let mut g = gate();
    let a = g.begin("a", 10, 1, None).expect("fixture");
    let queued = g.begin("a", 11, 1, None).expect("fixture");
    let b = g.begin("b", 11, 2, None).expect("fixture");
    assert_eq!(g.start(), vec![a.clone(), b.clone()]);
    assert!(g.start().is_empty());
    assert!(g.finish(&a));
    assert_eq!(g.start(), vec![queued.clone()]);
    assert!(!g.finish(&a));
    assert!(g.current(&queued));
    assert!(g.current(&b));
}
#[test]
fn first_failure_drains_waiters_before_retry_and_old_reply_cannot_relatch() {
    for reason in [
        Failure::Refused,
        Failure::Unsupported,
        Failure::Timeout,
        Failure::Missing,
    ] {
        let mut g = gate();
        let read = g.begin_read("a", 10, 1, "wrap").expect("fixture");
        let first = g.begin("a", 10, 1, Some(&read)).expect("fixture");
        let queued = g.begin("a", 11, 1, None).expect("fixture");
        assert_eq!(g.start(), vec![first.clone()]);
        assert!(g.pause(&first, reason));
        assert!(!g.current(&first));
        assert!(!g.current(&queued));
        assert!(!g.current_read(&read));
        assert!(g.start().is_empty());
        assert_eq!(g.begin("a", 10, 1, None), Err(reason.code()));
        g.retry("a");
        let next_read = g.begin_read("a", 10, 1, "wrap").expect("fixture");
        let next = g.begin("a", 10, 1, Some(&next_read)).expect("fixture");
        assert_eq!(g.start(), vec![next.clone()]);
        assert!(!g.pause(&first, reason));
        assert!(!g.finish(&first));
        assert!(!g.finish_read(&read));
        assert!(g.current(&next));
        assert!(g.current_read(&next_read));
        assert_eq!(g.failure("a"), None);
    }
}
#[test]
fn last_visible_demand_releases_stalled_read_but_preserves_explicit_archive() {
    let mut g = gate();
    let read = g.begin_read("a", 10, 1, "outer").expect("fixture");
    let stalled = g.begin("a", 10, 1, Some(&read)).expect("fixture");
    let archive = g.begin("a", 11, 1, None).expect("fixture");
    assert_eq!(g.start(), vec![stalled.clone()]);
    // Another visible view still owns the read demand.
    g.sync(&available(true), &clients());
    assert!(g.current_read(&read));
    assert!(g.current(&stalled));
    g.sync(&available(false), &clients());
    assert!(!g.current_read(&read));
    assert!(!g.current(&stalled));
    assert_eq!(g.start(), vec![archive.clone()]);
    assert_eq!(g.begin("a", 10, 1, Some(&read)), Err("offline"));
    g.sync(&available(true), &clients());
    let fresh = g.begin_read("a", 10, 1, "outer").expect("fixture");
    assert!(!g.finish_read(&read));
    assert!(g.current_read(&fresh));
    assert!(g.current(&archive));
}
#[test]
fn account_authority_and_client_detach_invalidate_inflight_work() {
    let mut g = gate();
    let read = g.begin_read("a", 10, 1, "wrap").expect("fixture");
    let old = g.begin("a", 10, 1, Some(&read)).expect("fixture");
    g.start();
    g.sync(&available(true), &[11].into());
    assert!(!g.current(&old));
    assert!(!g.current_read(&read));
    let next = g.begin("a", 11, 1, None).expect("fixture");
    g.start();
    let mut changed = available(true);
    changed.insert("a".into(), (3, true));
    g.sync(&changed, &clients());
    assert!(!g.current(&next));
    assert_eq!(g.begin("a", 11, 1, None), Err("signer-missing"));
    let fresh = g.begin("a", 11, 3, None).expect("fixture");
    assert_eq!(g.start(), vec![fresh.clone()]);
    assert!(!g.pause(&next, Failure::Refused));
    assert!(g.current(&fresh));
    changed.remove("a");
    g.sync(&changed, &clients());
    g.sync(&available(true), &clients());
    assert!(!g.current(&old));
    assert!(!g.current(&fresh));
}
#[test]
fn call_read_and_account_bounds_do_not_evict_live_work() {
    let mut g = gate();
    let a = g.begin_read("a", 10, 1, "a").expect("fixture");
    assert_eq!(g.begin_read("a", 10, 1, "a2"), Err("rate-limited"));
    let b = g.begin_read("b", 11, 2, "b").expect("fixture");
    let mut calls = Vec::new();
    for _ in 0..8 {
        calls.push(g.begin("a", 10, 1, None).expect("fixture"));
    }
    assert_eq!(g.begin("b", 11, 2, None), Err("too-large"));
    assert!(calls.iter().all(|lease| g.current(lease)));
    assert!(g.current_read(&a));
    assert!(g.current_read(&b));
    let many: BTreeMap<_, _> = (0..40)
        .map(|n| (format!("account-{n:02}"), (n, true)))
        .collect();
    g.sync(&many, &clients());
    assert_eq!(g.allowed("account-31", 31), Ok(()));
    assert_eq!(g.allowed("account-32", 32), Err("signer-missing"));
    let later: BTreeMap<_, _> = (0..40)
        .map(|n| (format!("account-{n:02}"), (n, true)))
        .rev()
        .collect();
    g.sync(&later, &clients());
    assert_eq!(g.allowed("account-32", 32), Err("signer-missing"));
}
#[test]
fn only_actual_signer_deadline_has_timeout_code() {
    assert_eq!(Failure::from_code("signer-timeout"), Some(Failure::Timeout));
    for code in [
        "offline",
        "upload-cancelled",
        "internal",
        "rate-limited",
        "too-large",
        "rejected",
    ] {
        assert_eq!(Failure::from_code(code), None);
    }
    assert_eq!(Failure::from_code("signer-missing"), Some(Failure::Missing));
}
