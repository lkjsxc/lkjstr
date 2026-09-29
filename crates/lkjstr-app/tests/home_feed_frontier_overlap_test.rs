use lkjstr_app::home_feed::paging::home_history_cursor;

#[path = "home_feed_frontier_fixture.rs"]
mod fixture;
use fixture::{cursor, event, filter, snapshot};

#[test]
fn overlapping_filter_union_does_not_prove_an_individual_prefix() {
    let relays = vec!["wss://overlap.example".to_owned()];
    let read = snapshot(
        vec![
            event(1, 100, &relays[0], 1),
            event(2, 90, &relays[0], 1),
            event(3, 10, &relays[0], 6),
            event(4, 5, &relays[0], 6),
        ],
        &relays,
    );
    let before = cursor(0, 110);
    let retained = cursor(4, 5);
    // The broad scope returned notes at 100 and 90. The narrow scope returned
    // reposts at 10 and 5. Their union cannot prove the broad scope reached 5.
    // A short broad response is allowed too; truncating to its limit is unsafe.
    for limit in [2, 30] {
        let mut broad = filter(1);
        broad.kinds = Some(vec![1, 6]);
        broad.limit = Some(limit);
        let mut narrow = filter(6);
        narrow.limit = Some(2);
        for filters in [
            vec![broad.clone(), narrow.clone()],
            vec![narrow.clone(), broad.clone()],
        ] {
            for previous in [None, Some(&before)] {
                assert_eq!(
                    home_history_cursor(&read, &relays, &filters, previous, Some(&retained)),
                    previous.cloned(),
                    "ambiguous filter provenance must not advance, limit={limit}",
                );
            }
        }
    }
}
