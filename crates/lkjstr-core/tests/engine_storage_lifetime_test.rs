use lkjstr_core::engine::storage_inspection::{Book, Count, Lease, Memory, Origin, MAX_SAFE};
fn start(book: &mut Book, client: u64, req: &str, at: u64) -> Result<Lease, &'static str> {
    book.begin(client, req, Memory { events: 8, event_payload_bytes: 900, at })?.ok_or("duplicate")
}
fn origin(at: u64) -> Origin { Origin::Ready { usage: 7000, quota: 9000, at, approximate: true } }
#[test]
fn wrong_port_cannot_close_another_request_with_the_same_id() -> Result<(), &'static str> {
    let mut book = Book::default(); let first = start(&mut book, 1, "same", 10)?;
    let second = start(&mut book, 2, "same", 10)?;
    book.close(3, "same"); assert!(book.current(&first)); assert!(book.current(&second));
    book.close(2, "same"); assert!(book.current(&first)); assert!(!book.current(&second));
    Ok(())
}
#[test]
fn replacement_rejects_late_callbacks_with_the_reused_request_string() -> Result<(), &'static str> {
    let mut book = Book::default(); let old = start(&mut book, 1, "same", 10)?;
    book.close(1, "same"); let fresh = start(&mut book, 1, "same", 12)?;
    assert_ne!(old, fresh);
    assert!(book.count(&old, Count::Ready { count: 999, at: 13 }, 13).is_none());
    assert!(book.origin(&old, origin(13), 13).is_none());
    assert!(book.current(&fresh));
    let reply = book.expire(fresh.deadline).pop().ok_or("missing expiry")?;
    assert_eq!(reply.report.persisted_events, Count::Timeout);
    assert_eq!(reply.report.origin, Origin::Timeout);
    Ok(())
}
#[test]
fn hidden_detached_and_stopped_owners_release_without_late_reports() -> Result<(), &'static str> {
    let mut book = Book::default(); let hidden = start(&mut book, 1, "r", 10)?;
    let other = start(&mut book, 2, "r", 10)?;
    book.visible(1, false);
    assert_eq!(start(&mut book, 1, "again", 10), Err("rejected"));
    assert!(book.origin(&hidden, origin(11), 11).is_none());
    assert!(book.current(&other));
    book.visible(1, true); let fresh = start(&mut book, 1, "r", 12)?;
    book.detach(1); assert!(!book.current(&fresh));
    book.clear(); assert!(book.expire(99_999).is_empty());
    assert!(!book.current(&other));
    let later = start(&mut book, 2, "r", 13)?;
    assert_ne!(later, other);
    Ok(())
}
#[test]
fn invalid_or_impossible_numbers_fail_without_manufacturing_zero() -> Result<(), &'static str> {
    let mut book = Book::default(); let lease = start(&mut book, 1, "r", 10)?;
    assert!(book.count(&lease, Count::Ready { count: MAX_SAFE + 1, at: 11 }, 11).is_none());
    let reply = book.origin(&lease, Origin::Ready { usage: 0, quota: MAX_SAFE + 1, at: 11, approximate: true }, 11).ok_or("missing failure")?;
    assert_eq!(reply.report.persisted_events, Count::Failed);
    assert_eq!(reply.report.origin, Origin::Failed);
    assert_eq!(start(&mut book, 1, "r", MAX_SAFE), Err("internal"));
    Ok(())
}
#[test]
fn component_timestamps_and_approximate_marker_must_be_truthful() -> Result<(), &'static str> {
    let mut book = Book::default(); let lease = start(&mut book, 1, "r", 10)?;
    assert!(book.count(&lease, Count::Ready { count: 1, at: 9 }, 11).is_none());
    let reply = book.origin(&lease, Origin::Ready { usage: 1, quota: 2, at: 12, approximate: false }, 12).ok_or("missing failure")?;
    assert_eq!(reply.report.persisted_events, Count::Failed);
    assert_eq!(reply.report.origin, Origin::Failed);
    Ok(())
}
#[test]
fn original_estimate_batch_cannot_adopt_a_new_owner_after_cancellation() -> Result<(), &'static str> {
    let mut book = Book::default(); let old = start(&mut book, 1, "r", 0)?;
    let batch = book.origin_work(); book.close(1, "r");
    let fresh = start(&mut book, 1, "r", 1)?;
    assert_eq!(batch, vec![old.clone()]);
    assert!(book.origin(&old, origin(2), 2).is_none());
    assert_eq!(book.origin_work(), vec![fresh]);
    Ok(())
}
