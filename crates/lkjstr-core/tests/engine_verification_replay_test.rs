//! Pressure replay retains inclusive timestamp ties and releases on route/view removal.
#![allow(clippy::expect_used)]
#[path = "engine_verification_support/mod.rs"]
mod support;
use std::collections::BTreeSet;
use support::*;
fn fill_backlog(engine: &mut Engine, count: usize) {
    let template = event(1_700_000_000, 1, "invalid backlog only", vec![]);
    for index in 0..count {
        let mut queued = template.clone();
        queued.id = format!("{index:064x}");
        engine.enqueue("unrelated".into(), queued);
    }
}
#[test]
fn tied_page_replay_reacquires_the_gap_once_before_advancing() {
    let (mut engine, req) = setup();
    let notes: Vec<_> = (0..200)
        .map(|index| event(1_700_000_200 - index / 4, 1, "tied archive", vec![]))
        .collect();
    for note in &notes[..8] {
        incoming(&mut engine, &req, note, NOW + 2);
    }
    fill_backlog(&mut engine, 4096 - 8);
    for note in &notes[8..] {
        incoming(&mut engine, &req, note, NOW + 3);
    }
    eose(&mut engine, &req, NOW + 4);
    let filter = lkjstr_protocol::parse_filter_value(&req[2]).expect("filter");
    assert!(!engine.network.page_finished(&filter));
    assert!(engine.network.page_cursor(&filter).is_none());
    requests(&mut engine);
    let mut retry = None;
    for turn in 0..130 {
        engine.tick(NOW + 2000 + turn);
        for frame in requests(&mut engine) {
            retry = Some(frame);
        }
    }
    let retry = retry.expect("debt retry after queue drains");
    assert_ne!(retry[1], req[1]);
    assert_eq!(retry[2], req[2]);
    // A stale EOSE from the abandoned wire cannot acknowledge the retry.
    eose(&mut engine, &req, NOW + 2131);
    assert!(!engine.network.page_finished(&filter));
    for note in &notes {
        incoming(&mut engine, &retry, note, NOW + 2132);
    }
    eose(&mut engine, &retry, NOW + 2133);
    let mut next = None;
    for turn in 0..12 {
        engine.tick(NOW + 2400 + turn * 200);
        for frame in requests(&mut engine) {
            if frame[2]["until"] == 1_700_000_151u64 {
                next = Some(frame);
            }
        }
    }
    let next = next.expect("inclusive next page after successful verification");
    for note in &notes[196..] {
        incoming(&mut engine, &next, note, NOW + 4800);
    }
    let tail = event(1_700_000_150, 1, "next older note", vec![]);
    incoming(&mut engine, &next, &tail, NOW + 4800);
    eose(&mut engine, &next, NOW + 4801);
    engine.tick(NOW + 5000);
    assert_eq!(diagnostics(&mut engine, NOW + 5001)["storedEvents"], 201);
    engine.input(
        Input::Window {
            sub: "feed".into(),
            anchor: None,
            before: 0,
            after: 800,
        },
        NOW + 5200,
    );
    let rows = engine
        .drain()
        .into_iter()
        .rev()
        .find_map(|output| match output {
            Output::Rows { sub, items, .. } if sub == "feed" => Some(items),
            _ => None,
        })
        .expect("recovered rows");
    let actual: BTreeSet<_> = rows.iter().map(|row| row.id.clone()).collect();
    let expected: BTreeSet<_> = notes
        .iter()
        .chain([&tail])
        .map(|note| note.id.clone())
        .collect();
    assert_eq!(rows.len(), 201);
    assert_eq!(actual, expected);
}
#[test]
fn abandoned_view_or_removed_route_releases_verification_retry() {
    for remove_route in [false, true] {
        let (mut engine, req) = setup();
        fill_backlog(&mut engine, 4096);
        incoming(
            &mut engine,
            &req,
            &event(1_700_000_200, 1, "overflow", vec![]),
            NOW + 2,
        );
        if remove_route {
            engine.input(Input::Configure { relays: Vec::new() }, NOW + 3);
        } else {
            engine.input(Input::Close { sub: "feed".into() }, NOW + 3);
        }
        assert_eq!(engine.network.request_progress("feed").0, 0);
        engine.tick(NOW + 2000);
        assert!(requests(&mut engine).is_empty());
        assert!(engine.network.open_wires().is_empty());
    }
}
