use lkjstr_core::engine::dm::{MAX_PARTICIPANTS, delivery::Tracker};
type Result = std::result::Result<(), Box<dyn std::error::Error>>;

#[test]
fn success_requires_each_recipient_including_self() -> Result {
    let mut progress = Tracker::new(3)?;
    assert!(!progress.accepted());
    assert!(progress.settle(1, true));
    assert!(progress.settle(0, true));
    assert!(!progress.complete());
    assert_eq!(progress.snapshot().accepted, 2);
    assert_eq!(progress.snapshot().total, 3);
    assert!(progress.settle(2, true));
    assert!(progress.complete());
    assert!(progress.accepted());
    Ok(())
}
#[test]
fn terminal_failures_and_duplicate_acknowledgements_do_not_change_counts() -> Result {
    let mut progress = Tracker::new(3)?;
    assert!(progress.settle(0, true));
    assert!(!progress.settle(0, true));
    assert!(!progress.settle(0, false));
    assert!(!progress.settle(99, true));
    assert!(progress.settle(1, false));
    assert!(!progress.settle(1, true));
    assert!(progress.settle(2, true));
    assert!(progress.complete());
    assert!(!progress.accepted());
    assert_eq!(progress.snapshot().accepted, 2);
    assert_eq!(progress.snapshot().total, 3);
    Ok(())
}
#[test]
fn empty_and_excessive_recipient_sets_are_rejected() -> Result {
    assert!(Tracker::new(0).is_err());
    assert!(Tracker::new(MAX_PARTICIPANTS + 1).is_err());
    let mut progress = Tracker::new(MAX_PARTICIPANTS)?;
    for recipient in 0..MAX_PARTICIPANTS {
        assert!(progress.settle(recipient, false));
    }
    assert!(progress.complete());
    assert_eq!(progress.snapshot().accepted, 0);
    Ok(())
}
