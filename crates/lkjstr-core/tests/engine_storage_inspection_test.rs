use lkjstr_core::engine::storage_inspection::{Book, Count, Lease, MAX_JOBS, Memory, Origin};
fn start(book: &mut Book, client: u64, req: &str, at: u64) -> Result<Lease, &'static str> {
    book.begin(
        client,
        req,
        Memory {
            events: 8,
            event_payload_bytes: 900,
            at,
        },
    )?
    .ok_or("duplicate")
}
fn origin(at: u64) -> Origin {
    Origin::Ready {
        usage: 7000,
        quota: 9000,
        at,
        approximate: true,
    }
}
#[test]
fn observations_keep_memory_and_transaction_count_separate() -> Result<(), &'static str> {
    let mut book = Book::default();
    let lease = start(&mut book, 1, "r", 10)?;
    assert!(
        book.count(&lease, Count::Ready { count: 23, at: 15 }, 16)
            .is_none()
    );
    let reply = book.origin(&lease, origin(18), 20).ok_or("missing reply")?;
    assert_eq!(
        (reply.report.started_at, reply.report.finished_at),
        (10, 20)
    );
    assert_eq!(
        reply.report.memory,
        Memory {
            events: 8,
            event_payload_bytes: 900,
            at: 10
        }
    );
    assert_eq!(
        reply.report.persisted_events,
        Count::Ready { count: 23, at: 15 }
    );
    assert_eq!(reply.report.origin, origin(18));
    assert!(!book.current(&lease));
    assert!(book.origin(&lease, origin(21), 21).is_none());
    Ok(())
}
#[test]
fn failed_estimate_does_not_discard_a_valid_count() -> Result<(), &'static str> {
    let mut book = Book::default();
    let lease = start(&mut book, 1, "r", 10)?;
    assert!(
        book.count(&lease, Count::Ready { count: 0, at: 11 }, 11)
            .is_none()
    );
    let reply = book
        .origin(&lease, Origin::Failed, 12)
        .ok_or("missing reply")?;
    assert_eq!(
        reply.report.persisted_events,
        Count::Ready { count: 0, at: 11 }
    );
    assert_eq!(reply.report.origin, Origin::Failed);
    Ok(())
}
#[test]
fn unsupported_database_does_not_discard_an_origin_estimate() -> Result<(), &'static str> {
    let mut book = Book::default();
    let lease = start(&mut book, 1, "r", 10)?;
    assert!(book.origin(&lease, origin(12), 12).is_none());
    let reply = book
        .count(&lease, Count::Unsupported, 14)
        .ok_or("missing reply")?;
    assert_eq!(reply.report.persisted_events, Count::Unsupported);
    assert_eq!(reply.report.origin, origin(12));
    Ok(())
}
#[test]
fn one_absolute_deadline_preserves_completed_components() -> Result<(), &'static str> {
    let mut book = Book::default();
    let lease = start(&mut book, 1, "r", 10)?;
    assert!(book.origin(&lease, origin(12), 12).is_none());
    assert!(book.expire(15_009).is_empty());
    let reply = book.expire(15_010).pop().ok_or("missing expiry")?;
    assert_eq!(reply.report.origin, origin(12));
    assert_eq!(reply.report.persisted_events, Count::Timeout);
    assert!(
        book.count(
            &lease,
            Count::Ready {
                count: 99,
                at: 15_011
            },
            15_011
        )
        .is_none()
    );
    Ok(())
}
#[test]
fn completion_at_deadline_stays_unknown_instead_of_claiming_ready() -> Result<(), &'static str> {
    let mut book = Book::default();
    let lease = start(&mut book, 1, "r", 0)?;
    assert!(book.origin(&lease, Origin::Unsupported, 2).is_none());
    let reply = book
        .count(
            &lease,
            Count::Ready {
                count: 9,
                at: 15_000,
            },
            15_000,
        )
        .ok_or("missing expiry")?;
    assert_eq!(reply.report.persisted_events, Count::Timeout);
    Ok(())
}
#[test]
fn capacity_is_one_per_client_four_total_and_duplicates_do_not_restart() -> Result<(), &'static str>
{
    let mut book = Book::default();
    let first = start(&mut book, 0, "r", 10)?;
    assert!(
        book.begin(
            0,
            "r",
            Memory {
                events: 0,
                event_payload_bytes: 0,
                at: 999
            }
        )?
        .is_none()
    );
    assert_eq!(book.leases(), vec![first]);
    assert_eq!(start(&mut book, 0, "second", 20), Err("too-large"));
    for client in 1..MAX_JOBS as u64 {
        start(&mut book, client, "r", 20)?;
    }
    assert_eq!(start(&mut book, 4, "r", 20), Err("too-large"));
    assert_eq!(book.count_work().len(), 4);
    assert!(book.count_work().is_empty());
    assert_eq!(book.origin_work().len(), 4);
    assert!(book.origin_work().is_empty());
    Ok(())
}
