#![allow(clippy::panic, clippy::unwrap_used)]
use lkjstr_core::engine::avatars::jobs::*;
fn owner(client: u64, request: usize) -> Owner {
    Owner {
        client,
        request: request.to_string(),
    }
}
fn deferred(commands: Vec<Command>) {
    assert!(matches!(
        commands.as_slice(),
        [Command::Reply {
            result: ResultKind::Deferred { .. },
            ..
        }]
    ));
}
#[test]
fn fetched_bodies_waiting_for_decode_keep_every_raw_credit() {
    let mut book = Book::default();
    for n in 0..20 {
        book.want(owner(1, n), &format!("https://host{n}.test/face"), 0);
    }
    let mut fetched = 0;
    for _ in 0..40 {
        for command in book.pump(0) {
            if let Command::Run(work) = command {
                match work.ticket.stage {
                    Stage::Lookup => {
                        book.complete(work.ticket, Completion::Miss, 0);
                    }
                    Stage::Fetch => {
                        fetched += 1;
                        book.complete(work.ticket, Completion::Fetched { bytes: 1024 }, 0);
                    }
                    Stage::Derive => {}
                    Stage::Store => panic!("no decode has settled"),
                }
            }
        }
        let counts = book.counts();
        assert!(counts.raw <= RAW_SLOTS && counts.fetches <= RAW_SLOTS && counts.derives <= 1);
    }
    assert_eq!(fetched, RAW_SLOTS);
    assert_eq!(book.counts().raw, RAW_SLOTS);
}
#[test]
fn requested_hostname_is_limited_independently_of_ports_and_url_spellings() {
    let mut book = Book::default();
    for n in 0..8 {
        book.want(
            owner(1, n),
            &format!("https://AVATAR.test:{}/{n}", 8000 + n),
            0,
        );
    }
    let mut fetches = 0;
    for _ in 0..4 {
        for command in book.pump(0) {
            if let Command::Run(work) = command {
                if work.ticket.stage == Stage::Fetch {
                    fetches += 1;
                } else {
                    book.complete(work.ticket, Completion::Miss, 0);
                }
            }
        }
    }
    assert_eq!(fetches, HOST_FETCHES);
}
#[test]
fn each_client_and_engine_bound_defers_without_an_original_image_bypass() {
    let mut book = Book::default();
    for n in 0..MAX_CLIENT_URLS {
        assert!(
            book.want(owner(1, n), &format!("https://avatar.test/{n}"), 0)
                .is_empty()
        );
    }
    deferred(book.want(owner(1, 999), "https://avatar.test/excess", 0));
    for n in MAX_CLIENT_URLS..MAX_JOBS {
        assert!(
            book.want(
                owner(2 + (n / MAX_CLIENT_URLS) as u64, n),
                &format!("https://avatar.test/{n}"),
                0
            )
            .is_empty()
        );
    }
    deferred(book.want(owner(8, 1), "https://avatar.test/job-excess", 0));
    assert_eq!(book.counts().jobs, MAX_JOBS);
    let mut book = Book::default();
    for client in 1..=8 {
        for n in 0..MAX_CLIENT_OWNERS {
            assert!(
                book.want(owner(client, n), "https://avatar.test/shared", 0)
                    .is_empty()
            );
        }
        deferred(book.want(
            owner(client, MAX_CLIENT_OWNERS),
            "https://avatar.test/shared",
            0,
        ));
    }
    assert_eq!(book.counts().owners, MAX_OWNERS);
    deferred(book.want(owner(9, 1), "https://avatar.test/shared", 0));
    book.detach(1);
    assert_eq!(book.counts().owners, MAX_OWNERS - MAX_CLIENT_OWNERS);
    assert_eq!(book.counts().negatives, 0);
}
#[test]
fn queue_wait_is_not_active_time_and_expiry_keeps_uncancellable_work_counted() {
    let mut book = Book::default();
    book.want(owner(1, 1), "https://avatar.test/a", 0);
    // Nine hours queued before the first stage starts does not exhaust the active budget.
    let start = 9 * 60 * 60 * 1000;
    let lookup = book
        .pump(start)
        .into_iter()
        .find_map(|c| {
            if let Command::Run(w) = c {
                Some(w)
            } else {
                None
            }
        })
        .unwrap();
    assert_eq!(lookup.timeout_ms, 3000);
    book.complete(lookup.ticket, Completion::Miss, start + 1);
    let fetch = book
        .pump(start + 1)
        .into_iter()
        .find_map(|c| {
            if let Command::Run(w) = c {
                Some(w)
            } else {
                None
            }
        })
        .unwrap();
    book.complete(fetch.ticket, Completion::Fetched { bytes: 100 }, start + 2);
    let codec = book
        .pump(start + 2)
        .into_iter()
        .find_map(|c| {
            if let Command::Run(w) = c {
                Some(w)
            } else {
                None
            }
        })
        .unwrap();
    let expired = book.expire(start + 10002);
    assert!(
        expired
            .iter()
            .any(|c| matches!(c, Command::Abort(t) if *t == codec.ticket))
    );
    assert_eq!(
        (
            book.counts().owners,
            book.counts().derives,
            book.counts().raw
        ),
        (0, 1, 1)
    );
    book.complete(
        codec.ticket,
        Completion::Derived { bytes: 100 },
        start + 10003,
    );
    assert_eq!((book.counts().jobs, book.counts().raw), (0, 0));
}
