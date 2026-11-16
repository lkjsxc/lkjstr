use lkjstr_core::engine::account_storage::{Failure, Read, Revision, State, load};

#[test]
fn only_confirmed_absence_initializes_empty() -> Result<(), Failure> {
    assert!(
        load(Read::Absent, Read::Text("0"))?
            .accounts
            .entries
            .is_empty()
    );
    for bad in [
        Read::Failed,
        Read::Text("not-json"),
        Read::Text("null"),
        Read::Text("{}"),
    ] {
        assert!(load(bad, Read::Text("0")).is_err());
    }
    assert!(load(Read::Absent, Read::Absent).is_err());
    assert!(load(Read::Absent, Read::Failed).is_err());
    assert!(load(Read::Absent, Read::Text("1")).is_err());
    Ok(())
}
#[test]
fn malformed_revision_does_not_become_zero() {
    for raw in [
        "",
        "00",
        "01",
        "+1",
        "-1",
        "1.0",
        " 1",
        "18446744073709551616",
    ] {
        assert!(Revision::parse(raw).is_err());
    }
}
#[test]
fn stale_account_snapshot_cannot_advance_after_a_new_key_commit() -> Result<(), Failure> {
    let initial = Revision::INITIAL;
    let newer = initial.compare(initial, true)?;
    assert_eq!(initial.compare(newer, true), Err(Failure::Conflict));
    assert_eq!(initial.compare(newer, false), Err(Failure::Conflict));
    Ok(())
}
#[test]
fn removal_and_identical_readd_never_restore_the_old_revision() -> Result<(), Failure> {
    let original = Revision::INITIAL;
    let removed = original.next()?;
    let readded = removed.next()?;
    assert_eq!(original.compare(readded, true), Err(Failure::Conflict));
    assert_ne!(original, readded);
    Ok(())
}
#[test]
fn read_only_and_session_checks_do_not_increment_revision() -> Result<(), Failure> {
    let value = Revision::parse("42")?;
    assert_eq!(value.compare(value, false)?, value);
    assert_eq!(value.compare(value, true)?.encoded(), "43");
    Ok(())
}
#[test]
fn rejected_host_does_not_adopt_a_new_baseline_or_replay() -> Result<(), Failure> {
    let initial = Revision::INITIAL;
    let mut state = State::Ready(initial);
    state.rejected(initial, Failure::Conflict);
    assert_eq!(state.expected(), Err(Failure::Conflict));
    assert_eq!(
        state.committed(initial, initial.next()?),
        Err(Failure::Conflict)
    );
    Ok(())
}
#[test]
fn failed_write_does_not_advance_the_host_baseline() -> Result<(), Failure> {
    let initial = Revision::INITIAL;
    let mut state = State::Ready(initial);
    state.rejected(initial, Failure::Unavailable);
    assert_eq!(state.expected()?, initial);
    state.committed(initial, initial.next()?)?;
    assert_eq!(state.expected()?.encoded(), "1");
    Ok(())
}
#[test]
fn maximum_revision_is_readable_but_cannot_wrap() -> Result<(), Failure> {
    let end = Revision::parse("18446744073709551615")?;
    assert_eq!(end.compare(end, false)?, end);
    assert_eq!(end.next(), Err(Failure::Exhausted));
    Ok(())
}
