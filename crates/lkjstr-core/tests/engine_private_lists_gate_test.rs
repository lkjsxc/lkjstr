//! Private lists share signer capacity without sharing Messages refusal or consent.
use lkjstr_core::engine::dm::signers::{Failure, Gate};
type Result = std::result::Result<(), Box<dyn std::error::Error>>;
fn gate() -> Gate {
    let mut g = Gate::default();
    g.sync(&[("a".into(), (1, true))].into(), &[1, 2].into());
    g
}
#[test]
fn dm_refusal_preserves_running_or_waiting_list_leases() -> Result {
    let mut g = gate();
    let dm = g.begin("a", 1, 1, None)?;
    let list = g.begin_list("a", 2, 1)?;
    assert_eq!(g.start(), vec![dm.clone()]);
    assert!(g.pause(&dm, Failure::Refused));
    assert!(g.current(&list));
    assert_eq!(g.start(), vec![list.clone()]);
    assert!(g.finish(&list));
    let another = g.begin_list("a", 1, 1)?;
    assert_eq!(g.start(), vec![another.clone()]);
    assert_eq!(g.begin("a", 1, 1, None), Err("signer-refused"));
    Ok(())
}
#[test]
fn list_refusal_cannot_poison_dm_and_explicit_dm_retry_does_not_revoke_lists() -> Result {
    let mut g = gate();
    let list = g.begin_list("a", 1, 1)?;
    assert_eq!(g.start(), vec![list.clone()]);
    assert!(!g.pause(&list, Failure::Refused));
    assert!(g.finish(&list));
    assert_eq!(g.failure("a"), None);
    let dm = g.begin("a", 2, 1, None)?;
    assert_eq!(g.start(), vec![dm.clone()]);
    assert!(g.pause(&dm, Failure::Timeout));
    let list = g.begin_list("a", 1, 1)?;
    g.retry("a");
    assert!(g.current(&list));
    assert_eq!(g.failure("a"), None);
    Ok(())
}
#[test]
fn shared_capacity_authority_and_client_removal_apply_to_both_purposes() -> Result {
    let mut g = gate();
    let mut calls = vec![];
    for _ in 0..4 {
        calls.push(g.begin_list("a", 1, 1)?);
        calls.push(g.begin("a", 2, 1, None)?);
    }
    assert_eq!(g.begin_list("a", 1, 1), Err("too-large"));
    assert_eq!(g.begin("a", 2, 1, None), Err("too-large"));
    assert_eq!(g.start().len(), 1);
    g.sync(&[("a".into(), (1, false))].into(), &[1].into());
    assert!(calls.iter().filter(|c| c.is_list()).all(|c| g.current(c)));
    assert!(calls.iter().filter(|c| !c.is_list()).all(|c| !g.current(c)));
    g.sync(&[("a".into(), (2, true))].into(), &[1].into());
    assert!(calls.iter().all(|c| !g.current(c)));
    assert_eq!(g.begin_list("a", 1, 1), Err("signer-missing"));
    Ok(())
}
