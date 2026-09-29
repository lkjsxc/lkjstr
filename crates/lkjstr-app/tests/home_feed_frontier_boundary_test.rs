mod home_feed_frontier_fixture;
use home_feed_frontier_fixture::{cursor, event, filter, relays, snapshot};
use lkjstr_app::home_feed::paging::home_history_cursor;

#[test]
fn raw_boundary_duplicates_prevent_skipping_unseen_same_second_events() {
    let relays = relays();
    let previous = cursor(2, 100);
    for value in [1, 2] {
        let input = snapshot(
            vec![
                event(value, 100, &relays[0], 1),
                event(9, 10, &relays[1], 1),
            ],
            &relays,
        );
        assert_eq!(
            home_history_cursor(&input, &relays, &[filter(1)], Some(&previous), None),
            Some(previous.clone())
        );
    }
    let input = snapshot(
        vec![event(3, 100, &relays[0], 1), event(9, 10, &relays[1], 1)],
        &relays,
    );
    assert_eq!(
        home_history_cursor(&input, &relays, &[filter(1)], Some(&previous), None),
        Some(cursor(3, 100))
    );
}

#[test]
fn continuation_cannot_pass_rows_evicted_by_newest_window_retention() {
    let relays = relays();
    let input = snapshot(
        vec![event(3, 80, &relays[0], 1), event(4, 1, &relays[1], 1)],
        &relays,
    );
    assert_eq!(
        home_history_cursor(
            &input,
            &relays,
            &[filter(1)],
            Some(&cursor(1, 100)),
            Some(&cursor(2, 90))
        ),
        Some(cursor(2, 90))
    );
    assert_eq!(
        home_history_cursor(
            &input,
            &relays,
            &[filter(1)],
            Some(&cursor(1, 100)),
            Some(&cursor(0, 110))
        ),
        Some(cursor(1, 100))
    );
}

#[test]
fn empty_scopes_do_not_invent_a_cursor_or_block_a_nonempty_complete_prefix() {
    let relays = relays();
    let mut input = snapshot(vec![], &relays);
    assert_eq!(
        home_history_cursor(&input, &relays, &[filter(1)], None, None),
        None
    );
    assert_eq!(
        home_history_cursor(&input, &relays, &[filter(1)], Some(&cursor(1, 100)), None),
        Some(cursor(1, 100))
    );
    input.events.push(event(2, 90, &relays[0], 1));
    assert_eq!(
        home_history_cursor(&input, &relays, &[filter(1)], None, None),
        Some(cursor(2, 90))
    );
}

#[test]
fn only_exact_filter_subscription_and_relay_provenance_enter_the_proof() {
    let relays = relays();
    let mut input = snapshot(vec![event(1, 90, &relays[0], 1)], &relays);
    let mut wrong_subscription = event(2, 100, &relays[1], 1);
    wrong_subscription.sub_id = "other".into();
    let mut wrong_author = event(3, 100, &relays[1], 1);
    wrong_author.event.pubkey = "b".repeat(64);
    input.events.extend([
        wrong_subscription,
        wrong_author,
        event(4, 100, "wss://unrequested.example", 1),
        event(5, 100, &relays[1], 6),
    ]);
    assert_eq!(
        home_history_cursor(&input, &relays, &[filter(1)], None, None),
        Some(cursor(1, 90))
    );
    assert_eq!(
        home_history_cursor(&input, &[], &[filter(1)], None, None),
        None
    );
    assert_eq!(home_history_cursor(&input, &relays, &[], None, None), None);
}

#[test]
fn shared_event_provenance_and_tied_scope_order_are_preserved() {
    let relays = relays();
    let mut shared = event(3, 100, &relays[0], 1);
    shared.relays.push(relays[1].clone());
    let input = snapshot(
        vec![
            shared,
            event(2, 100, &relays[0], 1),
            event(4, 100, &relays[1], 1),
        ],
        &relays,
    );
    assert_eq!(
        home_history_cursor(&input, &relays, &[filter(1)], None, None),
        Some(cursor(3, 100))
    );
}
