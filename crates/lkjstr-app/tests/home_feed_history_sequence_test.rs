mod home_feed_frontier_fixture;
use home_feed_frontier_fixture::{event, filter, relays, snapshot};
use lkjstr_app::{
    empty_feed_window,
    home_feed::paging::{home_history_cursor, home_window_from_snapshot},
};
use std::collections::BTreeSet;

#[test]
fn repeated_bounded_pages_visit_every_event_when_scopes_share_a_tail() -> Result<(), String> {
    assert_sequence(0)
}

#[test]
fn repeated_pages_preserve_the_complete_prefix_and_diagnose_a_stationary_scope()
-> Result<(), String> {
    assert_sequence(100)
}

fn assert_sequence(shift: u64) -> Result<(), String> {
    let relays = relays();
    let dense: Vec<_> = (1..=420)
        .rev()
        .map(|n| event(n, n + shift, &relays[0], 1))
        .collect();
    let sparse: Vec<_> = (1..=70)
        .rev()
        .map(|n| event(n + 1000, n, &relays[1], 1))
        .collect();
    let expected: BTreeSet<_> = dense
        .iter()
        .chain(&sparse)
        .map(|item| item.event.id.clone())
        .collect();
    for max in [5, 17, 180] {
        let mut window = empty_feed_window(9, max);
        let mut before: Option<lkjstr_app::FeedWindowCursor> = None;
        let mut seen = BTreeSet::new();
        let mut stopped = false;
        for _ in 0..1000 {
            let until = before.as_ref().map_or(1000, |cursor| cursor.created_at);
            let events = [&dense, &sparse]
                .into_iter()
                .flat_map(|source| {
                    source
                        .iter()
                        .filter(|item| item.event.created_at <= until)
                        .take(30)
                        .cloned()
                })
                .collect();
            let read = snapshot(events, &relays);
            window = home_window_from_snapshot(&window, read.clone(), before.as_ref());
            seen.extend(window.sorted_ids.iter().cloned());
            assert!(window.sorted_ids.len() <= max && window.events_by_id.len() <= max);
            let next = home_history_cursor(
                &read,
                &relays,
                &[filter(1)],
                before.as_ref(),
                window.oldest_cursor.as_ref(),
            );
            if next == before {
                stopped = true;
                break;
            }
            before = next;
        }
        assert!(
            stopped,
            "bounded sequence should eventually stop at an unproven boundary"
        );
        if shift == 0 {
            assert_eq!(seen, expected, "window cap {max} skipped an event");
            continue;
        }
        let boundary = before.as_ref().ok_or("nonempty history has no frontier")?;
        let prefix: BTreeSet<_> = dense
            .iter()
            .chain(&sparse)
            .filter(|item| {
                !lkjstr_app::home_feed::paging::home_event_before_cursor(&item.event, boundary)
            })
            .map(|item| item.event.id.clone())
            .collect();
        assert!(
            prefix.is_subset(&seen),
            "window cap {max} skipped a proven-prefix event"
        );
        assert_ne!(
            seen, expected,
            "a stationary scope must not fabricate global exhaustion"
        );
        assert_eq!(boundary.created_at, 101);
    }
    Ok(())
}
