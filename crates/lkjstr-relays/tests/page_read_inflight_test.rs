use lkjstr_relays::{
    InFlightPageReadRegistry, PageReadAbortOutcome, PageReadAttachAction, PageReadAttachment,
    PageReadSettleOutcome,
};

#[test]
fn registry_shares_matching_page_reads() {
    let mut registry = InFlightPageReadRegistry::new();

    let first = registry.attach(attachment("same-page", "tab-a", true, true));
    let second = registry.attach(attachment("same-page", "tab-b", true, true));

    assert_eq!(first.action, PageReadAttachAction::Start);
    assert_eq!(second.action, PageReadAttachAction::Share);
    assert_eq!(second.owner_count, 2);
    assert_eq!(second.listener_count, 2);
    assert_eq!(second.abort_signal_count, 2);
    assert_eq!(registry.counts().reads, 1);
}

#[test]
fn abort_marks_shared_work_for_all_owners() -> Result<(), String> {
    let mut registry = InFlightPageReadRegistry::new();
    registry.attach(attachment("abort-page", "tab-a", true, false));
    registry.attach(attachment("abort-page", "tab-b", true, true));

    let PageReadAbortOutcome::Aborted(cleanup) = registry.abort("abort-page") else {
        return Err("wanted abort cleanup".to_owned());
    };
    let shared = registry.attach(attachment("abort-page", "tab-c", false, false));

    assert!(cleanup.aborted);
    assert_eq!(cleanup.owner_count, 2);
    assert_eq!(shared.action, PageReadAttachAction::Share);
    assert!(shared.aborted);
    Ok(())
}

#[test]
fn settle_removes_read_and_reports_listener_cleanup() -> Result<(), String> {
    let mut registry = InFlightPageReadRegistry::new();
    registry.attach(attachment("settle-page", "tab-a", true, true));
    registry.attach(attachment("settle-page", "tab-a", true, true));

    let PageReadSettleOutcome::Settled(cleanup) = registry.settle("settle-page") else {
        return Err("wanted settled cleanup".to_owned());
    };

    assert_eq!(cleanup.owner_count, 1);
    assert_eq!(cleanup.listener_count, 2);
    assert_eq!(cleanup.abort_signal_count, 2);
    assert_eq!(registry.counts().reads, 0);
    assert!(matches!(
        registry.settle("settle-page"),
        PageReadSettleOutcome::Missing
    ));
    Ok(())
}

#[test]
fn close_aborts_all_reads_and_blocks_new_attachments() {
    let mut registry = InFlightPageReadRegistry::new();
    registry.attach(attachment("a", "tab-a", true, false));
    registry.attach(attachment("b", "tab-b", false, true));

    let cleanup = registry.close();
    let attach_after_close = registry.attach(attachment("c", "tab-c", true, true));

    assert_eq!(cleanup.len(), 2);
    assert!(cleanup.iter().all(|read| read.aborted));
    assert_eq!(registry.counts().reads, 0);
    assert!(registry.is_closed());
    assert_eq!(attach_after_close.action, PageReadAttachAction::Closed);
}

fn attachment(
    read_key: &str,
    owner_id: &str,
    has_abort_signal: bool,
    has_snapshot_listener: bool,
) -> PageReadAttachment {
    PageReadAttachment {
        read_key: read_key.to_owned(),
        owner_id: owner_id.to_owned(),
        has_abort_signal,
        has_snapshot_listener,
    }
}
