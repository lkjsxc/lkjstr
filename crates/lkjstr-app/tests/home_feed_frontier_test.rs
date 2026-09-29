mod home_feed_frontier_fixture;
use home_feed_frontier_fixture::{cursor, event, filter, relays, snapshot};
use lkjstr_app::home_feed::paging::home_history_cursor;
use lkjstr_relays::{ProgressiveReadStatus, ProgressiveRelayState};

#[test]
fn each_relay_constrains_the_frontier_independently_of_displayed_oldest() {
    let relays = relays();
    let input = snapshot(
        vec![
            event(1, 100, &relays[0], 1),
            event(2, 90, &relays[0], 1),
            event(3, 10, &relays[1], 1),
            event(4, 1, &relays[1], 1),
        ],
        &relays,
    );
    assert_eq!(
        home_history_cursor(&input, &relays, &[filter(1)], None, Some(&cursor(4, 1))),
        Some(cursor(2, 90))
    );
    let mut reversed = input.clone();
    reversed.events.reverse();
    reversed.relays.reverse();
    assert_eq!(
        home_history_cursor(&reversed, &relays, &[filter(1)], None, None),
        Some(cursor(2, 90))
    );
}

#[test]
fn each_filter_on_one_relay_constrains_the_common_frontier() {
    let relays = vec![relays()[0].clone()];
    let input = snapshot(
        vec![event(1, 100, &relays[0], 1), event(2, 10, &relays[0], 6)],
        &relays,
    );
    assert_eq!(
        home_history_cursor(&input, &relays, &[filter(1), filter(6)], None, None),
        Some(cursor(1, 100))
    );
}

#[test]
fn incomplete_scope_evidence_never_advances_a_known_or_initial_boundary() {
    let relays = relays();
    let original = snapshot(vec![event(1, 90, &relays[0], 1)], &relays);
    for state in [
        ProgressiveRelayState::Pending,
        ProgressiveRelayState::Reading,
        ProgressiveRelayState::Timeout,
        ProgressiveRelayState::Closed,
        ProgressiveRelayState::Auth,
        ProgressiveRelayState::Error,
        ProgressiveRelayState::Cancelled,
    ] {
        let mut input = original.clone();
        input.relays[1].state = state;
        for previous in [None, Some(cursor(2, 100))] {
            assert_eq!(
                home_history_cursor(&input, &relays, &[filter(1)], previous.as_ref(), None),
                previous
            );
        }
    }
    for status in [
        ProgressiveReadStatus::Partial,
        ProgressiveReadStatus::Incomplete,
        ProgressiveReadStatus::Failed,
        ProgressiveReadStatus::Cancelled,
    ] {
        let mut input = original.clone();
        input.status = status;
        assert_eq!(
            home_history_cursor(&input, &relays, &[filter(1)], None, None),
            None
        );
    }
    let mut input = original.clone();
    input.final_read = false;
    assert_eq!(
        home_history_cursor(&input, &relays, &[filter(1)], None, None),
        None
    );
}

#[test]
fn absent_duplicate_or_wrong_relay_status_cannot_prove_the_frontier() {
    let relays = relays();
    let mut input = snapshot(vec![event(1, 90, &relays[0], 1)], &relays);
    input.relays.pop();
    assert_eq!(
        home_history_cursor(&input, &relays, &[filter(1)], None, None),
        None
    );
    input.relays.push(input.relays[0].clone());
    assert_eq!(
        home_history_cursor(&input, &relays, &[filter(1)], None, None),
        None
    );
    input.relays[1].relay = "wss://unrequested.example".into();
    assert_eq!(
        home_history_cursor(&input, &relays, &[filter(1)], None, None),
        None
    );
}
