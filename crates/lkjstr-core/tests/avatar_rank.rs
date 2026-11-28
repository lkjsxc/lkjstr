#![allow(clippy::unwrap_used)]
use lkjstr_core::engine::avatars::jobs::*;
fn owner(request: &str) -> Owner {
    Owner {
        client: 1,
        request: request.into(),
    }
}
/// Run every permitted step once; lookups miss, fetches stay active. Returns the keys that began a fetch.
fn step(book: &mut Book, now: u64) -> Vec<String> {
    let mut fetching = Vec::new();
    for command in book.pump(now) {
        if let Command::Run(work) = command {
            match work.ticket.stage {
                Stage::Lookup => {
                    book.complete(work.ticket, Completion::Miss, now);
                }
                Stage::Fetch => fetching.push(work.key),
                _ => {}
            }
        }
    }
    fetching
}
#[test]
fn a_face_on_screen_runs_before_rows_ahead_that_asked_earlier() {
    let mut book = Book::default();
    for n in 0..10 {
        book.want_ranked(
            owner(&format!("far{n}")),
            &format!("https://h{n}.test/a"),
            0,
            false,
            2,
        );
    }
    book.want_ranked(owner("near"), "https://next.test/a", 0, false, 1);
    book.want_ranked(owner("seen"), "https://screen.test/a", 0, false, 0);
    let first: Vec<_> = book
        .pump(0)
        .into_iter()
        .filter_map(|command| match command {
            Command::Run(work) => Some(work.key),
            _ => None,
        })
        .collect();
    assert_eq!(first[0], "https://screen.test/a");
    assert_eq!(first[1], "https://next.test/a");
}
#[test]
fn rows_ahead_leave_fetch_slots_for_the_screen() {
    let mut book = Book::default();
    for n in 0..12 {
        book.want_ranked(
            owner(&format!("far{n}")),
            &format!("https://h{n}.test/a"),
            0,
            false,
            2,
        );
    }
    let mut started = 0;
    for _ in 0..6 {
        started += step(&mut book, 0).len();
    }
    assert_eq!(started, RAW_SLOTS - 4, "rank 2 keeps four slots free");
    book.want_ranked(owner("seen"), "https://screen.test/a", 0, false, 0);
    let mut seen = Vec::new();
    for _ in 0..3 {
        seen.extend(step(&mut book, 0));
    }
    assert_eq!(seen, ["https://screen.test/a"]);
}
#[test]
fn asking_again_from_the_screen_lifts_a_queued_job() {
    let mut book = Book::default();
    for n in 0..6 {
        book.want_ranked(
            owner(&format!("far{n}")),
            &format!("https://h{n}.test/a"),
            0,
            false,
            2,
        );
    }
    // The same picture comes on screen: its new request joins the job, then the old one leaves.
    assert!(
        book.want_ranked(owner("again"), "https://h5.test/a", 0, false, 0)
            .is_empty()
    );
    assert!(book.release(&owner("far5")).is_empty());
    let first = book.pump(0).into_iter().find_map(|command| match command {
        Command::Run(work) => Some(work.key),
        _ => None,
    });
    assert_eq!(first.as_deref(), Some("https://h5.test/a"));
}
fn fail_fetch(book: &mut Book, request: &str, url: &str, now: u64) {
    assert!(book.want(owner(request), url, now).is_empty());
    let mut ticket = None;
    for _ in 0..2 {
        for command in book.pump(now) {
            if let Command::Run(work) = command {
                if work.ticket.stage == Stage::Fetch {
                    ticket = Some(work.ticket);
                } else {
                    book.complete(work.ticket, Completion::Miss, now);
                }
            }
        }
    }
    book.complete(ticket.unwrap(), Completion::Failed(Failure::Transient), now);
}
#[test]
fn two_failed_reads_send_the_rest_of_a_host_straight_to_the_plain_image() {
    let mut book = Book::default();
    fail_fetch(&mut book, "a", "https://closed.test/1", 0);
    assert!(
        book.want(owner("b"), "https://closed.test/2", 1).is_empty(),
        "one failure still tries"
    );
    assert!(
        book.release(&owner("b"))
            .iter()
            .all(|c| !matches!(c, Command::Reply { .. }))
    );
    fail_fetch(&mut book, "c", "https://closed.test/3", 2);
    let reply = book.want(owner("d"), "https://closed.test/4", 3);
    assert!(matches!(
        reply.as_slice(),
        [Command::Reply {
            job: None,
            result: ResultKind::Fallback { uniform: false },
            ..
        }]
    ));
    assert!(
        book.want(owner("e"), "https://open.test/1", 3).is_empty(),
        "other hosts are untouched"
    );
    assert!(
        book.want(owner("f"), "https://closed.test/5", 3 + HOST_BACKOFF_MS)
            .is_empty(),
        "the host is tried again after the backoff"
    );
}
