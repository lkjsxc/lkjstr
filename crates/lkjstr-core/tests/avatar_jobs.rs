use lkjstr_core::engine::avatars::{cache, jobs::*, pixels};
fn owner(client: u64, request: &str) -> Owner {
    Owner {
        client,
        request: request.into(),
    }
}
fn one(book: &mut Book, stage: Stage, now: u64) -> Ticket {
    let work: Vec<_> = book
        .pump(now)
        .into_iter()
        .filter_map(|command| match command {
            Command::Run(work) if work.ticket.stage == stage => Some(work.ticket),
            _ => None,
        })
        .collect();
    assert_eq!(work.len(), 1, "one requested stage");
    work[0]
}
fn derive(book: &mut Book, request: &str, url: &str) -> Ticket {
    assert!(book.want(owner(1, request), url, 0).is_empty());
    let lookup = one(book, Stage::Lookup, 0);
    assert!(book.complete(lookup, Completion::Miss, 1).is_empty());
    let fetch = one(book, Stage::Fetch, 1);
    assert!(
        book.complete(fetch, Completion::Fetched { bytes: 2048 }, 2)
            .is_empty()
    );
    one(book, Stage::Derive, 2)
}
#[test]
fn uniform_frame_is_a_bounded_negative_without_store_work_or_cache_bytes() {
    let mut book = Book::default();
    let url = "https://avatar.test/blank.gif";
    let ticket = derive(&mut book, "first", url);
    let pixels = pixels::classify(&[200, 200, 200, 251, 204, 204, 204, 255]).unwrap();
    assert!(pixels.uniform);
    let commands = book.complete(
        ticket,
        Completion::Failed(Failure::Unsupported {
            uniform: pixels.uniform,
        }),
        3,
    );
    assert!(commands.iter().any(|command| matches!(
        command,
        Command::Reply {
            result: ResultKind::Fallback { uniform: true },
            ..
        }
    )));
    assert!(
        !commands
            .iter()
            .any(|command| matches!(command, Command::Run(_)))
    );
    assert!(book.pump(3).is_empty());
    assert_eq!(book.counts().jobs, 0);
    assert_eq!(book.counts().negatives, 1);
    let cache = cache::Totals::default();
    assert_eq!((cache.entries, cache.bytes), (0, 0));
    let later = book.want(owner(1, "later"), url, 599_999);
    assert!(matches!(
        later.as_slice(),
        [Command::Reply {
            result: ResultKind::Fallback { uniform: true },
            ..
        }]
    ));
    // Reading the negative does not extend its fixed expiry.
    assert!(book.want(owner(1, "expired"), url, 600_004).is_empty());
    assert_eq!(book.counts().negatives, 0);
}
#[test]
fn span_five_reaches_storage_and_size_policy_never_upscales() {
    let pixels = pixels::classify(&[200, 200, 200, 255, 205, 200, 200, 255]).unwrap();
    assert!(!pixels.uniform);
    assert!(pixels.opaque);
    assert_eq!(pixels::edge(1024, 512), Some(160));
    assert_eq!(pixels::edge(24, 40), Some(24));
    assert_eq!(pixels::edge(0, 40), None);
    assert!(pixels::classify(&[]).is_none());
    let mut book = Book::default();
    let ticket = derive(&mut book, "five", "https://avatar.test/five");
    assert!(
        book.complete(ticket, Completion::Derived { bytes: 4442 }, 3)
            .is_empty()
    );
    let store = one(&mut book, Stage::Store, 3);
    let plan = cache::insert(
        cache::Totals::default(),
        &[],
        "https://avatar.test/five",
        4442,
    )
    .unwrap();
    assert_eq!((plan.totals.entries, plan.totals.bytes), (1, 4442));
    let commands = book.complete(store, Completion::Stored, 4);
    assert!(commands.iter().any(|command| matches!(
        command,
        Command::Reply {
            result: ResultKind::Ready { retained: true },
            ..
        }
    )));
}
#[test]
fn shared_owners_release_independently_and_old_completion_cannot_consume_new_job() {
    let mut book = Book::default();
    let url = "https://avatar.test/shared";
    let a = owner(1, "a");
    let b = owner(2, "b");
    let c = owner(1, "c");
    book.want(a.clone(), url, 0);
    book.want(b.clone(), url, 0);
    let old = one(&mut book, Stage::Lookup, 0);
    assert!(book.release(&a).is_empty());
    assert_eq!(book.release(&b), vec![Command::Abort(old)]);
    assert_eq!(book.counts().lookups, 1);
    book.want(c.clone(), url, 1);
    let new = one(&mut book, Stage::Lookup, 1);
    assert_ne!(old.job, new.job);
    assert_eq!(
        book.complete(old, Completion::Hit { bytes: 4442 }, 2),
        vec![Command::Release(old.job)]
    );
    assert_eq!(book.counts().owners, 1);
    let replies = book.complete(new, Completion::Hit { bytes: 4442 }, 2);
    assert!(
        replies
            .iter()
            .any(|command| matches!(command, Command::Reply { owner, .. } if owner == &c))
    );
    assert_eq!(book.counts().jobs, 0);
}
#[test]
fn cancelled_codec_holds_raw_and_decode_permits_until_its_real_settlement() {
    let mut book = Book::default();
    let url = "https://avatar.test/cancel";
    let old = derive(&mut book, "old", url);
    assert_eq!(book.release(&owner(1, "old")), vec![Command::Abort(old)]);
    book.want(owner(1, "new"), url, 3);
    let lookup = one(&mut book, Stage::Lookup, 3);
    book.complete(lookup, Completion::Miss, 3);
    let fetch = one(&mut book, Stage::Fetch, 3);
    book.complete(fetch, Completion::Fetched { bytes: 2048 }, 4);
    assert_eq!((book.counts().raw, book.counts().derives), (2, 1));
    assert!(book.pump(4).is_empty());
    book.complete(
        old,
        Completion::Failed(Failure::Unsupported { uniform: true }),
        5,
    );
    assert_eq!(book.counts().negatives, 0);
    let new = one(&mut book, Stage::Derive, 5);
    assert_ne!(old.job, new.job);
    assert_eq!((book.counts().raw, book.counts().derives), (1, 1));
}
#[test]
fn quota_failure_fans_out_and_backs_off_writes_without_negative_poisoning() {
    let mut book = Book::default();
    let url = "https://avatar.test/quota";
    let ticket = derive(&mut book, "first", url);
    book.want(owner(2, "second"), url, 2);
    book.complete(ticket, Completion::Derived { bytes: 500 }, 3);
    let store = one(&mut book, Stage::Store, 3);
    let results = book.complete(store, Completion::StoreUnavailable, 4);
    assert_eq!(
        results
            .iter()
            .filter(|command| matches!(
                command,
                Command::Reply {
                    result: ResultKind::Ready { retained: false },
                    ..
                }
            ))
            .count(),
        2
    );
    assert_eq!(book.counts().negatives, 0);
    let other = derive(&mut book, "other", "https://avatar.test/other");
    let results = book.complete(other, Completion::Derived { bytes: 500 }, 5);
    assert!(results.iter().any(|command| matches!(
        command,
        Command::Reply {
            result: ResultKind::Ready { retained: false },
            ..
        }
    )));
    assert_eq!(book.counts().stores, 0);
}
