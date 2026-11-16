//! Verification backlog must block both paging entry points and false exhaustion.
#![allow(clippy::expect_used)]
#[path = "engine_verification_support/mod.rs"]
mod support;
use lkjstr_protocol::NostrFilter;
use support::*;
#[test]
fn automatic_refill_waits_for_the_page_verification_backlog() {
    let (mut engine, req) = setup();
    full_page(&mut engine, &req);
    for turn in 1..=6 {
        engine.tick(NOW + turn * 200);
        assert!(engine.network.verifying);
        let frames = requests(&mut engine);
        assert!(
            frames.iter().all(|f| f[2]["until"].is_null()),
            "raw EOSE advanced before its page was verified: {frames:?}"
        );
    }
    let mut advanced = false;
    for turn in 7..=12 {
        engine.tick(NOW + turn * 200);
        advanced |= requests(&mut engine)
            .iter()
            .any(|f| !f[2]["until"].is_null());
    }
    assert!(!engine.network.verifying);
    assert!(
        advanced,
        "a verified full page can advance after auxiliary lookups answer"
    );
}
#[test]
fn explicit_window_waits_for_verification_and_short_tail_is_not_yet_exhausted() {
    let (mut engine, req) = setup();
    full_page(&mut engine, &req);
    engine.input(
        Input::Window {
            sub: "feed".into(),
            anchor: None,
            before: 0,
            after: 200,
        },
        NOW + 200,
    );
    assert!(
        requests(&mut engine).is_empty(),
        "Window must not bypass the verification barrier"
    );
    let (mut short, req) = setup();
    incoming(
        &mut short,
        &req,
        &event(1_700_000_200, 1, "tail", vec![]),
        NOW + 2,
    );
    eose(&mut short, &req, NOW + 3);
    short.drain();
    short.input(
        Input::Window {
            sub: "feed".into(),
            anchor: None,
            before: 0,
            after: 200,
        },
        NOW + 200,
    );
    assert!(
        short.drain().into_iter().all(|output| !matches!(
            output,
            Output::Rows {
                at_bottom: true,
                ..
            }
        )),
        "unverified short tail cannot claim an acquired end"
    );
}
#[test]
fn queue_overflow_revokes_page_completion_and_replays_the_original_span() {
    let (mut engine, req) = setup();
    let template = event(1_700_000_000, 1, "unrelated verification backlog", vec![]);
    // Invalid signatures deliberately keep the bounded verifier occupied; they never enter the store.
    for index in 0..4096 {
        let mut queued = template.clone();
        queued.id = format!("{index:064x}");
        engine.enqueue("unrelated".into(), queued);
    }
    let wanted = event(1_700_000_200, 1, "must survive queue pressure", vec![]);
    incoming(&mut engine, &req, &wanted, NOW + 2);
    eose(&mut engine, &req, NOW + 3);
    let filter: NostrFilter = lkjstr_protocol::parse_filter_value(&req[2]).expect("filter");
    assert!(
        !engine.network.page_exhausted(&filter),
        "a dropped eligible event invalidates an empty/short EOSE"
    );
    assert!(engine.network.page_cursor(&filter).is_none());
    assert_eq!(diagnostics(&mut engine, NOW + 4)["dropped"], 1);
    requests(&mut engine);
    engine.tick(NOW + 2000);
    assert!(
        requests(&mut engine).is_empty(),
        "pressure retry waits for the current backlog"
    );
    for turn in 1..=128 {
        engine.tick(NOW + 2000 + turn);
    }
    let replay = requests(&mut engine)
        .into_iter()
        .next()
        .expect("bounded retry after verification drains");
    assert_eq!(
        replay[2], req[2],
        "retry preserves the missing span instead of a later watermark"
    );
    incoming(&mut engine, &replay, &wanted, NOW + 2200);
    eose(&mut engine, &replay, NOW + 2201);
    engine.tick(NOW + 2400);
    assert_eq!(diagnostics(&mut engine, NOW + 2401)["storedEvents"], 1);
    assert!(engine.network.page_exhausted(&filter));
}
