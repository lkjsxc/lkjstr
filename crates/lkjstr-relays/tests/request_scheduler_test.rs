use lkjstr_relays::{PendingReq, RelayReqScheduler};

#[test]
fn scheduler_starts_immediately_under_active_limit() {
    let mut scheduler = RelayReqScheduler::default();

    let outcome = scheduler.schedule(PendingReq::new("first", false), 1);

    assert_eq!(outcome.started.as_deref(), Some("first"));
    assert_eq!(scheduler.active_ids(), vec!["first"]);
    assert!(!scheduler.has_pending());
}

#[test]
fn scheduler_queues_and_releases_pending_requests() {
    let mut scheduler = RelayReqScheduler::default();
    scheduler.schedule(PendingReq::new("first", false), 1);
    let outcome = scheduler.schedule(PendingReq::new("second", false), 1);

    assert_eq!(outcome.started, None);
    assert_eq!(scheduler.pending_ids(), vec!["second"]);

    let released = scheduler.release("first", 1);
    assert_eq!(released.started, vec!["second"]);
    assert_eq!(scheduler.active_ids(), vec!["second"]);
}

#[test]
fn scheduler_drops_oldest_non_critical_when_pending_is_full() {
    let mut scheduler = RelayReqScheduler::new(2);
    scheduler.schedule(PendingReq::new("active", false), 1);
    scheduler.schedule(PendingReq::new("critical", true), 1);
    scheduler.schedule(PendingReq::new("drop-me", false), 1);

    let outcome = scheduler.schedule(PendingReq::new("new", false), 1);

    assert_eq!(outcome.dropped, vec!["drop-me"]);
    assert_eq!(scheduler.pending_ids(), vec!["critical", "new"]);
}

#[test]
fn scheduler_removes_matching_active_and_pending_ids() {
    let mut scheduler = RelayReqScheduler::default();
    scheduler.schedule(PendingReq::new("active", false), 1);
    scheduler.schedule(PendingReq::new("pending", false), 1);

    scheduler.remove("active");
    scheduler.remove("pending");

    assert!(scheduler.active_ids().is_empty());
    assert!(scheduler.pending_ids().is_empty());
}
